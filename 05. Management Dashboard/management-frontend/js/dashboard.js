// Renders the sections (status / upload / access code / share link) and wires
// them to the API. Pure DOM — no framework.
import { getDetail, uploadResume, savePass } from "./api.js";
import { logout, getSub } from "./auth.js";
import { SITE_BASE } from "./config.js";

export async function renderDashboard(root) {
  const sub = await getSub(); // = resumeId

  root.innerHTML = `
    <div class="resume">
      <div class="resume-topbar">
        <h2>Manage your resume</h2>
        <button id="logout" class="resume-btn resume-btn--ghost">Sign out</button>
      </div>

      <div id="error" class="resume-error" hidden></div>
      <div id="status"></div>

      <section class="resume-section">
        <h3 id="upload-title">Upload resume</h3>
        <input id="file" type="file" accept="application/pdf" />
        <button id="upload" class="resume-btn" disabled>Upload PDF</button>
      </section>

      <section class="resume-section">
        <h3>Access code</h3>
        <p class="resume-hint">Visitors need this code (in the share link) to view your resume.</p>
        <input id="pass" class="resume-input" type="text" placeholder="e.g. let-me-in-2026" />
        <button id="save-pass" class="resume-btn" disabled>Save code</button>
        <span id="pass-ok" class="resume-ok" hidden>✓ saved</span>
      </section>

      <section class="resume-section">
        <h3>Shareable link</h3>
        <p class="resume-hint">Send this to anyone who should see your resume.</p>
        <input id="share" class="resume-input" type="text" readonly
               placeholder="Set an access code above to generate a link" />
        <button id="copy" class="resume-btn" disabled>Copy</button>
        <span id="copy-ok" class="resume-ok" hidden>✓ copied</span>
      </section>
    </div>
  `;

  const $ = (id) => root.querySelector("#" + id);
  const showError = (m) => { const e = $("error"); e.textContent = m || ""; e.hidden = !m; };

  let uploaded = false;

  // Build example.com/auth/index.html?pass=<code>&resumeId=<sub>
  function updateShare(pass) {
    if (pass && sub) {
      const url = `${SITE_BASE}/auth/index.html`
        + `?pass=${encodeURIComponent(pass)}`
        + `&resumeId=${encodeURIComponent(sub)}`;
      $("share").value = url;
      $("copy").disabled = false;
    } else {
      $("share").value = "";
      $("copy").disabled = true;
    }
    $("copy-ok").hidden = true;
  }

  $("logout").onclick = () => logout().then(() => location.reload());
  $("file").onchange = () => { $("upload").disabled = !$("file").files[0]; };

  $("pass").oninput = () => {
    $("save-pass").disabled = !$("pass").value;
    $("pass-ok").hidden = true;
    updateShare($("pass").value); // live preview as they type
  };

  $("copy").onclick = async () => {
    await navigator.clipboard.writeText($("share").value);
    $("copy-ok").hidden = false;
  };

  $("upload").onclick = async () => {
    const file = $("file").files[0];
    if (!file) return;
    $("upload").disabled = true;
    $("upload").textContent = "Uploading…";
    showError("");
    try {
      await uploadResume(file);
      $("file").value = "";
      await load();
    } catch (err) {
      showError(err.message);
      $("upload").textContent = uploaded ? "Replace PDF" : "Upload PDF";
      $("upload").disabled = !$("file").files[0];
    }
  };

  $("save-pass").onclick = async () => {
    const pass = $("pass").value;
    if (!pass) return;
    $("save-pass").disabled = true;
    $("save-pass").textContent = "Saving…";
    showError("");
    try {
      await savePass(pass);
      $("pass-ok").hidden = false;
      updateShare(pass);
    } catch (err) {
      showError(err.message);
    } finally {
      $("save-pass").textContent = "Save code";
      $("save-pass").disabled = !$("pass").value;
    }
  };

  async function load() {
    showError("");
    try {
      const d = await getDetail();
      uploaded = d.uploaded ?? d.views !== undefined;

      $("status").innerHTML = uploaded
        ? `<div class="resume-status">
             <span class="resume-badge">● Live</span>
             <span class="resume-views">👁 ${d.views ?? 0} views</span>
           </div>`
        : `<div class="resume-status resume-status--muted">
             No resume uploaded yet — add a PDF below to go live.
           </div>`;

      $("upload-title").textContent = uploaded ? "Replace resume" : "Upload resume";
      $("upload").textContent = uploaded ? "Replace PDF" : "Upload PDF";
      $("upload").disabled = !$("file").files[0];

      if (d.pass) {
        $("pass").value = d.pass;
        updateShare(d.pass); // show the link straight away if a code exists
      }
    } catch (err) {
      showError(err.message);
    }
  }

  await load();
}
