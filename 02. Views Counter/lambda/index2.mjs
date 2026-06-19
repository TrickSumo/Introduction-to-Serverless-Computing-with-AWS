import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "resume";
const RESUME_ID = "resume123";

export const handler = async () => {

const { Attributes } = await dynamo.send(
  new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { resumeId: RESUME_ID },
    UpdateExpression: "ADD #views :inc",
    ExpressionAttributeNames: {
      "#views": "views",
    },
    ExpressionAttributeValues: {
      ":inc": 1,
    },
    ReturnValues: "UPDATED_NEW",
  })
);

  return {
    statusCode: 200,
    body: JSON.stringify({ views: Attributes?.views ?? 0 }),
  };
};