// All calls to the management API. Identity travels in the access token; the
// backend reads `sub` from the verified token, never from us.
import { API_BASE } from "./config.js";
import { getToken } from "./auth.js";

async function request(path, options = {}) {
  const token = await getToken();
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

export const getDetail = () => request("/detail");

export const savePass = (pass) =>
  request("/pass", { method: "PUT", body: JSON.stringify({ pass }) });

// Two-step upload: get a presigned URL, then PUT the file straight to S3.
export async function uploadResume(file) {
  const { url } = await request("/upload-url");
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
}
