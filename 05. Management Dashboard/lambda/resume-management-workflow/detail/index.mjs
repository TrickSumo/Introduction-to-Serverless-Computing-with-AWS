import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const TABLE_NAME = process.env.TABLE_NAME || "resume";
const BUCKET = process.env.BUCKET;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

// GET /api/management/detail  ->  { uploaded, views, pass }
// Identity comes ONLY from the verified Cognito access token, so this always
// returns "the logged-in user's" resume -- never anyone else's.
export const handler = async (event) => {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { error: "Unauthorized" });

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { resumeId: sub },
      ProjectionExpression: "#v, #p",
      ExpressionAttributeNames: { "#v": "views", "#p": "pass" },
    })
  );

  // "uploaded" reflects whether the PDF actually exists in S3 -- not just
  // whether a DynamoDB row exists (a user may have set a pass but no file).
  let uploaded = false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `media/${sub}/resume.pdf` }));
    uploaded = true;
  } catch (err) {
    if (err.name !== "NotFound" && err.$metadata?.httpStatusCode !== 404) throw err;
  }

  return json(200, {
    uploaded,
    views: Item?.views ?? 0,
    pass: Item?.pass ?? "",
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
