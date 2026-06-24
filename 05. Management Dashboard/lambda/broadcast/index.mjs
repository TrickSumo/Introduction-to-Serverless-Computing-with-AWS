import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = process.env.TABLE_NAME || "connections";

// @connections callback endpoint of the WebSocket API:
// https://<apiId>.execute-api.<region>.amazonaws.com/<stage>
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const apigw = new ApiGatewayManagementApiClient({ endpoint: WEBSOCKET_ENDPOINT });

export const handler = async (event) => {
  if (!WEBSOCKET_ENDPOINT) {
    console.error("WEBSOCKET_ENDPOINT not set");
    return;
  }

  // A single stream batch can contain view changes for MULTIPLE resumes
  // (different users viewed at once). Keep the latest count PER resume so we
  // don't drop everyone but the last record.
  const latestByResume = new Map();
  for (const record of event.Records) {
    if (record.eventName === "REMOVE" || !record.dynamodb?.NewImage) continue;
    const img = unmarshall(record.dynamodb.NewImage);
    if (img.views === undefined || img.resumeId === undefined) continue;
    latestByResume.set(img.resumeId, Number(img.views)); // last write wins per resume
  }

  if (latestByResume.size === 0) return; // nothing relevant in this batch

  // Scan connections ONCE, grouped by the resume each socket is watching.
  const byResume = await getConnectionsByResume();

  const sends = [];
  for (const [resumeId, views] of latestByResume) {
    const message = JSON.stringify({ type: "views", resumeId, views });
    for (const connectionId of byResume.get(resumeId) ?? []) {
      sends.push(send(connectionId, message));
    }
  }
  await Promise.all(sends);
};

async function send(connectionId, message) {
  try {
    await apigw.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: message }));
  } catch (err) {
    if (err.name === "GoneException" || err.$metadata?.httpStatusCode === 410) {
      // Stale connection -> clean it up.
      await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { connectionId } }));
    } else {
      console.error(`postToConnection failed for ${connectionId}`, err);
    }
  }
}

async function getConnectionsByResume() {
  // Scan + group is fine at course scale. To scale up, add a GSI on
  // `resumeId` and Query per changed resume instead -- noted, not needed here.
  const byResume = new Map();
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: "connectionId, resumeId",
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) {
      if (!item.resumeId) continue;
      if (!byResume.has(item.resumeId)) byResume.set(item.resumeId, []);
      byResume.get(item.resumeId).push(item.connectionId);
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return byResume;
}
