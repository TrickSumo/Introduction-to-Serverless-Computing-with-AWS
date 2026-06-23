import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "connections";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const { connectionId, routeKey } = event.requestContext;

  try {
    if (routeKey === "$disconnect") {
      await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { connectionId } }));
      return { statusCode: 200, body: "Disconnected" };
    }

    // $connect: remember WHICH resume this socket is watching so broadcast can
    // push only to the right viewers. resumeId was set as a cookie during the
    // /auth flow (before the redirect to /), so the browser already has it and
    // sends it on the WebSocket handshake -- no query string needed.
    const resumeId = getCookie(event, "resumeId");

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { connectionId, resumeId, connectedAt: Date.now() },
      })
    );
    return { statusCode: 200, body: "Connected" };
  } catch (err) {
    console.error(`Failed to handle ${routeKey} for ${connectionId}`, err);
    return { statusCode: 500, body: "Connection error" };
  }
};

// The WebSocket handshake is an HTTP request, so the browser attaches cookies
// for the CloudFront domain. (CloudFront must forward the Cookie header to the
// /wss behavior, or this comes back empty.)
function getCookie(event, name) {
  const header = event?.headers?.Cookie || event?.headers?.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
