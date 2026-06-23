import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "resume";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// PUT /api/management/pass   body { pass }
// Sets/updates the share code on the logged-in user's resume item. UpdateItem
// creates the row if it doesn't exist yet (first-time user setting a code).
export const handler = async (event) => {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { error: "Unauthorized" });

  let pass;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString()
      : event.body;
    pass = JSON.parse(raw || "{}").pass;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!pass || typeof pass !== "string") {
    return json(400, { error: "pass is required" });
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { resumeId: sub },
      UpdateExpression: "SET #p = :p",
      ExpressionAttributeNames: { "#p": "pass" },
      ExpressionAttributeValues: { ":p": pass },
    })
  );

  return { statusCode: 204 };
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
