// Minimal auth demo:
//   not logged in -> "Unauthenticated" + Sign in
//   logged in     -> the tokens (raw + decoded) + Sign out
import { bootstrap, login, logout } from "./auth.js";

const app = document.getElementById("app");

// Decode a JWT payload (middle segment) for display. Purely cosmetic.
function decode(jwt) {
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.stringify(JSON.parse(atob(part)), null, 2);
  } catch {
    return "(could not decode)";
  }
}

(async () => {
  let user;
  try {
    user = await bootstrap();
  } catch (err) {
    app.innerHTML = `<div class="auth"><p class="auth-error">${err.message}</p></div>`;
    return;
  }

  if (!user) {
    app.innerHTML = `
      <div class="auth">
        <span class="badge badge--out">● Unauthenticated</span>
        <button id="login" class="btn">Sign in</button>
      </div>`;
    document.getElementById("login").onclick = () => login();
    return;
  }

  app.innerHTML = `
    <div class="auth">
      <div class="auth-bar">
        <span class="badge badge--in">● Authenticated</span>
        <button id="logout" class="btn btn--ghost">Sign out</button>
      </div>

      <h3>Access token</h3>
      <pre class="token">${user.access_token}</pre>
      <h3>Access token — decoded</h3>
      <pre class="claims">${decode(user.access_token)}</pre>

      <h3>ID token</h3>
      <pre class="token">${user.id_token}</pre>
      <h3>ID token — decoded</h3>
      <pre class="claims">${decode(user.id_token)}</pre>
    </div>`;
  document.getElementById("logout").onclick = () => logout().then(() => location.reload());
})();
