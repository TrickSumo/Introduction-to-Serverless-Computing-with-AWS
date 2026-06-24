// Cognito Hosted UI (OIDC) config — same pool as the dashboard.
export const COGNITO = {
  authority: "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_CqJq7jYWh",
  client_id: "bdsma5ie1sra08cv15ks55vsv",
  // Must be registered EXACTLY as an "Allowed callback URL" on the app client.
  redirect_uri: window.location.origin + window.location.pathname,
  response_type: "code", // Authorization Code + PKCE
  scope: "openid email phone",
};
