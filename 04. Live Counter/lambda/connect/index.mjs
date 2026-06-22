import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
 
const TABLE_NAME = process.env.TABLE_NAME || "connections";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const { connectionId, routeKey } = event.requestContext;

  console.log(connectionId, routeKey)

  try {
    if (routeKey === "$disconnect") {
      await ddb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { connectionId },
      }));
      return { statusCode: 200, body: "Disconnected" };
    }

    // $connect (and default)
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        connectionId,
        connectedAt: Date.now(),
      },
    }));
    return { statusCode: 200, body: "Connected" };
  } catch (err) {
    console.error(`Failed to handle ${routeKey} for ${connectionId}`, err);
    return { statusCode: 500, body: "Connection error" };
  }
};