import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "resume";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  // resumeId comes from the cookie set at /auth (same source as the signed
  // cookies), so only a viewer who already authenticated can bump this
  // counter -- not anyone hitting /api/views?resumeId=<anyone>.
  const resumeId = getCookie(event, "resumeId");

  if (!resumeId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "resumeId missing",
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

// HTTP API (v2) exposes cookies as an array; REST API puts them in the header.
// Either way, CloudFront must forward the Cookie header to /api/*.
function getCookie(event, name) {
  const fromArray = event?.cookies?.find((c) => c.startsWith(name + "="));
  if (fromArray) return fromArray.split("=").slice(1).join("=");
  const header = event?.headers?.Cookie || event?.headers?.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
