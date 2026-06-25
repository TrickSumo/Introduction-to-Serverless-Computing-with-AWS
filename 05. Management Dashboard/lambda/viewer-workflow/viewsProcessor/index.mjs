import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "resume";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  // resumeId is the partition key. The authorizer already VERIFIED the signed
  // cookie and extracted resumeId, so we trust the value it passed in context
  // (no need to re-parse the cookie here).
  const resumeId = event.requestContext?.authorizer?.lambda?.resumeId;

  if (!resumeId) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "text/plain" },
      body: "Unauthorized",
    };
  }

  // UPDATED_NEW returns ONLY the changed attribute ({ views: N }) -- so even
  // though `pass` lives on the same item, it can never leak to the browser.
  const { Attributes } = await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { resumeId },
      UpdateExpression: "ADD #views :inc",
      ExpressionAttributeNames: { "#views": "views" },
      ExpressionAttributeValues: { ":inc": 1 },
      ReturnValues: "UPDATED_NEW",
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ views: Attributes?.views ?? 0 }),
  };
};
