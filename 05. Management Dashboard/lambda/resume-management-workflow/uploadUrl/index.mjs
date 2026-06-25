import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.BUCKET;
const s3 = new S3Client({});

// GET /api/management/upload-url  ->  { url }
// Returns a short-lived presigned PUT URL. The browser then uploads the PDF
// straight to S3 -- the file bytes never pass through API Gateway or Lambda.
// The key is derived from the token's sub, so a user can only ever presign
// their OWN media/<sub>/resume.pdf.
export const handler = async (event) => {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { error: "Unauthorized" });

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `media/${sub}/resume.pdf`,
      ContentType: "application/pdf",
    }),
    { expiresIn: 300 } // 5 minutes
  );

  return json(200, { url });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
