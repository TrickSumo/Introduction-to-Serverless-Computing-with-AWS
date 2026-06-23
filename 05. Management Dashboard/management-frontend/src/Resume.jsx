import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

const API_BASE = "/api/management";

export default function Resume() {
    const auth = useAuth();
    const token = auth.user?.access_token;

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [pass, setPass] = useState("");
    const [savingPass, setSavingPass] = useState(false);
    const [passSaved, setPassSaved] = useState(false);

    async function api(path, options = {}) {
        const res = await fetch(API_BASE + path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers,
            },
        });
        if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
        return res.status === 204 ? null : res.json();
    }

    async function loadDetail() {
        setLoading(true);
        setError("");
        try {
            const d = await api("/detail");
            setDetail(d);
            setPass(d?.pass ?? "");
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (token) loadDetail();
    }, [token]);

    // --- upload: 1) get presigned URL, 2) PUT the file straight to S3 ---------
    async function handleUpload() {
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            const { url } = await api("/upload-url");
            const put = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/pdf" },
                body: file,
            });
            if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
            setFile(null);
            await loadDetail(); // reflect the new "uploaded" state
        } catch (e) {
            setError(e.message);
        } finally {
            setUploading(false);
        }
    }

    // --- access code update ----------------------------------------------------
    async function handleSavePass() {
        setSavingPass(true);
        setPassSaved(false);
        setError("");
        try {
            await api("/pass", { method: "PUT", body: JSON.stringify({ pass }) });
            setPassSaved(true);
            setDetail((d) => ({ ...(d ?? {}), uploaded: true, pass }));
        } catch (e) {
            setError(e.message);
        } finally {
            setSavingPass(false);
        }
    }

    const uploaded = detail?.uploaded ?? detail?.views !== undefined;

    if (loading) return <div className="resume"><p>Loading your resume…</p></div>;



    return (
        <div className="resume">
            <h2>Manage your resume</h2>

            {error && <div className="resume-error">{error}</div>}

            {/* ---- status ---- */}
            {uploaded ? (
                <div className="resume-status">
                    <span className="resume-badge">● Live</span>
                    <span className="resume-views">👁 {detail.views ?? 0} views</span>
                </div>
            ) : (
                <div className="resume-status resume-status--muted">
                    No resume uploaded yet — add a PDF below to go live.
                </div>
            )}

            {/* ---- upload (both new and existing users) ---- */}
            <section className="resume-section">
                <h3>{uploaded ? "Replace resume" : "Upload resume"}</h3>
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                    className="resume-btn"
                    disabled={!file || uploading}
                    onClick={handleUpload}
                >
                    {uploading ? "Uploading…" : uploaded ? "Replace PDF" : "Upload PDF"}
                </button>
            </section>

            {/* ---- access code ---- */}
            <section className="resume-section">
                <h3>Access code</h3>
                <p className="resume-hint">Visitors need this code (in the share link) to view your resume.</p>
                <input
                    className="resume-input"
                    type="text"
                    value={pass}
                    placeholder="e.g. let-me-in-2026"
                    onChange={(e) => { setPass(e.target.value); setPassSaved(false); }}
                />
                <button
                    className="resume-btn"
                    disabled={!pass || savingPass}
                    onClick={handleSavePass}
                >
                    {savingPass ? "Saving…" : "Save code"}
                </button>
                {passSaved && <span className="resume-ok">✓ saved</span>}
            </section>
        </div>
    );
}
