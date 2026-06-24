// Entry point: resolve auth, then either show "Sign in" or the dashboard.
import { bootstrap, login } from "./auth.js";
import { renderDashboard } from "./dashboard.js";

const app = document.getElementById("app");

(async () => {
  let user;
  try {
    user = await bootstrap();
  } catch (err) {
    app.innerHTML = `<div class="resume"><div class="resume-error">${err.message}</div></div>`;
    return;
  }

  if (!user) {
    app.innerHTML = `
      <div class="resume">
        <button id="login" class="resume-btn">Sign in to manage your resume</button>
      </div>`;
    document.getElementById("login").onclick = () => login();
    return;
  }

  await renderDashboard(app);
})();
