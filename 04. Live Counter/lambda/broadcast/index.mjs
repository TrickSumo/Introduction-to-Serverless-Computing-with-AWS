import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = process.env.TABLE_NAME || "connections";

// The WebSocket endpoint to send messages to, e.g. https://ID.execute-api.ap-south-1.amazonaws.com/production/
// This is the management/callback endpoint the lambda uses to postToConnection
// Copy @connections URL from AWS Console → API Gateway → WebSocket API → Stages → production (or your stage) → @connections
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT || "https://xlxdcx6sv0.execute-api.ap-south-1.amazonaws.com/production";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const apigw = new ApiGatewayManagementApiClient({ endpoint: WEBSOCKET_ENDPOINT });

export const handler = async (event) => {

  console.log(event);
  
  if (!WEBSOCKET_ENDPOINT) {
    console.error("WEBSOCKET_ENDPOINT not set");
    return;
  }

  // Pull the latest view-count change out of the stream batch.
  let latest = null;
  for (const record of event.Records) {
    if (record.eventName === "REMOVE" || !record.dynamodb?.NewImage) continue;
    const img = unmarshall(record.dynamodb.NewImage);
    if (img.views === undefined || img.resumeId === undefined) continue; // not the counter item
    latest = { resumeId: img.resumeId, views: Number(img.views) };
  }

  if (!latest) return; // nothing relevant in this batch (e.g. only connection inserts)

  const message = JSON.stringify({ type: "views", ...latest });
  const connections = await getConnections();

  await Promise.all(
    connections.map((connectionId) => send(connectionId, message))
  );
};

async function send(connectionId, message) {
  try {
    await apigw.send(
      new PostToConnectionCommand({ ConnectionId: connectionId, Data: message })
    );
  } catch (err) {
    if (err.name === "GoneException" || err.$metadata?.httpStatusCode === 410) {
      // Stale connection — clean it up.
      await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { connectionId } }));
    } else {
      console.error(`postToConnection failed for ${connectionId}`, err);
    }
  }
}

async function getConnections() {
  const ids = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: "connectionId, #v",
        ExpressionAttributeNames: { "#v": "views" },
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) {
      if (item.views === undefined) ids.push(item.connectionId); // skip the counter item
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return ids;
}
