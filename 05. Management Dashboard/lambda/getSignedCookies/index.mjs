import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const privateKeyRaw = process.env.privateKey;
const privateKey = privateKeyRaw?.replace(/\\n/g, "\n");

const cloudfrontDistributionDomain = process.env.cloudfrontDistributionDomain; // https://<ID>.cloudfront.net
const keyPairId = process.env.keyPairId;                                        // K33...........
const TABLE_NAME = process.env.TABLE_NAME || "resume";

const intervalToAddInMilliseconds = 86400 * 1000; // 24 hours

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const text = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "text/plain" },
  body,
});

export const handler = async (event) => {
  if (!privateKey) {
    return text(500, "privateKey not set in environment variables");
  }

  // Visitor opens a share link -> /auth/index.html?pass=<token>&resumeId=<sub>
  // which calls /api/auth/getSignedCookies?pass=<token>&resumeId=<sub>
  const pass = event?.queryStringParameters?.pass;
  const resumeId = event?.queryStringParameters?.resumeId;

  if (!resumeId) return text(400, "resumeId missing");
  if (!pass) return text(400, "Auth token missing");

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { resumeId },
      ProjectionExpression: "pass",
    })
  );

  if (!Item || Item.pass === undefined) {
    return text(404, "Resume not found");
  }

  if (pass !== Item.pass) {
    return text(401, "Invalid auth token");
  }

  // Even if a visitor tampers with the resumeId cookie to point at another
  // user, CloudFront will 403 them -- their policy only covers media/<sub>/*.
  const key = `media/${resumeId}/*`;
  const url = `${cloudfrontDistributionDomain}/${key}`;
  const dateLessThan = Math.floor((Date.now() + intervalToAddInMilliseconds) / 1000);

  const policy = {
    Statement: [
      {
        Resource: url,
        Condition: { DateLessThan: { "AWS:EpochTime": dateLessThan } },
      },
    ],
  };

  const cookies = getSignedCookies({
    keyPairId,
    privateKey,
    policy: JSON.stringify(policy),
  });

  const expires = new Date(dateLessThan * 1000).toUTCString();
  const base = `Expires=${expires}; Path=/; Secure; SameSite=None`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    cookies: [
      // CloudFront reads these -> HttpOnly so page JS can't touch them.
      `CloudFront-Key-Pair-Id=${cookies["CloudFront-Key-Pair-Id"]}; ${base}; HttpOnly`,
      `CloudFront-Signature=${cookies["CloudFront-Signature"]}; ${base}; HttpOnly`,
      `CloudFront-Policy=${cookies["CloudFront-Policy"]}; ${base}; HttpOnly`,
      // The page JS reads this to know which resume to load -> NOT HttpOnly.
      // It's only a pointer; the signed cookies above are the real gate.
      `resumeId=${resumeId}; ${base}`,
    ],
    body: JSON.stringify({ resumeId }),
  };
};
