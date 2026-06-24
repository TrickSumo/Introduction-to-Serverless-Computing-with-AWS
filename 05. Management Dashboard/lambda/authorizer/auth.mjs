import crypto from "crypto";

// CloudFront base64 uses URL-safe substitutions: + = /  ->  - _ ~
const cfDecode = (s) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");

// Verify the CloudFront signed cookies the same way CloudFront does:
// RSA-SHA1 over the policy, plus expiry + resource-scope checks.
// (Validated end-to-end against real CloudFront cookies in /experiment.)
export function verifySignedCookies({ policy, signature, resumeId }, publicKey) {
  const policyBytes = cfDecode(policy); // the exact bytes that were signed

  const signatureValid = crypto
    .createVerify("RSA-SHA1")
    .update(policyBytes)
    .verify(publicKey, cfDecode(signature));

  const json = JSON.parse(policyBytes.toString());
  const resource = json.Statement[0].Resource;
  const exp = json.Statement[0].Condition.DateLessThan["AWS:EpochTime"];
  const now = Math.floor(Date.now() / 1000);

  const expired = exp < now;
  const scopeOk = resource.endsWith(`media/${resumeId}/*`);

  return {
    ok: signatureValid && !expired && scopeOk,
    signatureValid,
    expired,
    scopeOk,
    resource,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
