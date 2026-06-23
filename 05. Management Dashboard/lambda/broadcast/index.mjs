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

  // Pull the latest view-count change out of the DynamoDB Streams batch.
  let latest = null;
  for (const record of event.Records) {
    if (record.eventName === "REMOVE" || !record.dynamodb?.NewImage) continue;
    const img = unmarshall(record.dynamodb.NewImage);
    if (img.views === undefined || img.resumeId === undefined) continue;
    latest = { resumeId: img.resumeId, views: Number(img.views) };
  }

  if (!latest) return; // nothing relevant in this batch

  const message = JSON.stringify({ type: "views", ...latest });

  // *** Multi-tenant fix: only push to sockets watching THIS resume. ***
  const connections = await getConnectionsFor(latest.resumeId);

  await Promise.all(connections.map((connectionId) => send(connectionId, message)));
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

async function getConnectionsFor(resumeId) {
  // Scan + filter is fine at course scale. To scale up, add a GSI on
  // `resumeId` and Query instead of Scan -- noted, but not needed here.
  const ids = [];
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
      if (item.resumeId === resumeId) ids.push(item.connectionId);
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return ids;
}
