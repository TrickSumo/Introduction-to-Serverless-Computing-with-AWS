// Cognito Hosted UI (OIDC) + API config. Edit these for your pool.
export const COGNITO = {
  authority: "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_CqJq7jYWh",
  client_id: "bdsma5ie1sra08cv15ks55vsv",
  // Must be registered EXACTLY as an "Allowed callback URL" on the app client.
  // Using origin+pathname so it works wherever this page is hosted.
  redirect_uri: window.location.origin + window.location.pathname,
  response_type: "code", // Authorization Code + PKCE (oidc-client-ts handles it)
  scope: "openid email phone",
};

// All management endpoints sit behind the Cognito JWT authorizer.
export const API_BASE = "/api/management";

// Public site origin where VISITORS view resumes (your CloudFront domain).
// Used to build the shareable link. In local dev this differs from the
// dashboard origin, so set it explicitly to the deployed site, e.g.:
//   export const SITE_BASE = "https://example.com";
export const SITE_BASE = window.location.origin;
