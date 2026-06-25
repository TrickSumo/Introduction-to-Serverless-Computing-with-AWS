// Shared Lambda authorizer for BOTH gateways:
//   - HTTP API      -> GET /api/views  (simple response)
//   - WebSocket API -> $connect /wss   (IAM policy response)
//
// Re-verifies the SAME CloudFront signed cookies that gate /media/<sub>/*,
// with the SAME public key. No new token, no secret, no DB read.

import { verifySignedCookies } from "./auth.mjs";

// Use format_public_key.py to convert the CloudFront public key into a single-line string with \n escaped.
// Then set it as the publicKey env var. The Lambda authorizer will reconstitute it into PEM format for use by verifySignedCookies().
const publicKey = process.env.publicKey?.replace(/\\n/g, "\n");
if (!publicKey) throw new Error("publicKey env var not set");

// Cookies arrive differently per gateway:
//   HTTP API (2.0) -> event.cookies = ["name=value", ...]
//   WebSocket      -> event.headers.Cookie = "name=value; name=value"
//   Authorizer     -> identity source ($request.header.Cookie)
function readCookies(event) {
  const out = {};
  const add = (s) => {
    const i = s.indexOf("=");
    if (i > 0) out[s.slice(0, i).trim()] = s.slice(i + 1);
  };
  const addHeader = (h) => h && h.split(";").forEach((c) => add(c.trim()));

  if (Array.isArray(event.cookies)) event.cookies.forEach(add);
  addHeader(event.headers?.Cookie || event.headers?.cookie);
  if (Array.isArray(event.identitySource)) event.identitySource.forEach(addHeader);

  return out;
}

function evaluate(event) {
  const c = readCookies(event);
  const resumeId = c["resumeId"];

  if (!resumeId || !c["CloudFront-Policy"] || !c["CloudFront-Signature"]) {
    return { ok: false };
  }

  try {
    const { ok } = verifySignedCookies(
      { policy: c["CloudFront-Policy"], signature: c["CloudFront-Signature"], resumeId },
      publicKey
    );
    return { ok, resumeId: ok ? resumeId : undefined };
  } catch (err) {
    console.error("verify failed:", err?.message);
    return { ok: false };
  }
}

export const handler = async (event) => {
  const { ok, resumeId } = evaluate(event);

  const isWebSocket =
    event.requestContext?.connectionId !== undefined ||
    event.requestContext?.eventType === "CONNECT" ||
    event.requestContext?.routeKey === "$connect";

  if (isWebSocket) {
    return {
      principalId: resumeId || "anonymous",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: ok ? "Allow" : "Deny",
            Resource: event.methodArn,
          },
        ],
      },
      context: ok ? { resumeId } : {},
    };
  }

  return {
    isAuthorized: ok,
    context: ok ? { resumeId } : {},
  };
};
