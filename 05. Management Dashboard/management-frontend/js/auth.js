// Thin wrapper around oidc-client-ts — the framework-agnostic engine that
// react-oidc-context wraps. Handles the Hosted UI redirect, PKCE, the token
// exchange, storage, and silent refresh for us.
import { UserManager } from "https://cdn.jsdelivr.net/npm/oidc-client-ts@3/+esm";
import { COGNITO } from "./config.js";

const mgr = new UserManager(COGNITO);

// Call once on page load. If we just came back from Hosted UI with a ?code=,
// finish the exchange; then return the current user (or null if logged out).
export async function bootstrap() {
  if (location.search.includes("code=")) {
    await mgr.signinCallback();
    history.replaceState({}, "", location.pathname); // strip ?code from URL
  }
  return mgr.getUser();
}

export function login() {
  return mgr.signinRedirect(); // → Cognito Hosted UI (login / signup / confirm)
}

export function logout() {
  return mgr.removeUser(); // local sign-out (clears stored tokens)
}

// Always pull the token fresh so we get a silently-renewed one if needed.
export async function getToken() {
  const user = await mgr.getUser();
  return user?.access_token;
}

// The logged-in user's Cognito `sub` — this IS the resumeId. Read from the
// id-token claims (oidc-client-ts puts them on user.profile).
export async function getSub() {
  const user = await mgr.getUser();
  return user?.profile?.sub;
}
