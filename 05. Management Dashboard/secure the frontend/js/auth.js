// Same auth wrapper as the dashboard — oidc-client-ts driving Cognito Hosted UI.
import { UserManager } from "https://cdn.jsdelivr.net/npm/oidc-client-ts@3/+esm";
import { COGNITO } from "./config.js";

const mgr = new UserManager(COGNITO);

export async function bootstrap() {
  if (location.search.includes("code=")) {
    await mgr.signinCallback();
    history.replaceState({}, "", location.pathname);
  }
  return mgr.getUser();
}

export function login() {
  return mgr.signinRedirect();
}

export function logout() {
  return mgr.removeUser();
}
