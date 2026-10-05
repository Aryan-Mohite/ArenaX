import axios from "axios";

// In production: same origin (/api), Vite dev proxy handles /api → localhost:5000
const API = axios.create({
  baseURL: "/api",
});

// ─── DEVICE ID ────────────────────────────────────────────────────────────────
// A random id kept in localStorage AND a first-party cookie, so clearing one
// of them does not reset it. Sent on every request; the server only uses it for
// abuse detection (see Privacy Policy, section 4). Never contains personal data.
const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getDeviceId() {
  try {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("ax_did="))?.split("=")[1];
    let id = localStorage.getItem("ax_did");
    if (!DEVICE_RE.test(id || "")) id = DEVICE_RE.test(cookie || "") ? cookie : null;
    if (!id) id = crypto.randomUUID();
    localStorage.setItem("ax_did", id);
    document.cookie = `ax_did=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    return id;
  } catch {
    return null; // storage blocked: the server simply gets no device signal
  }
}

// ─── REQUEST: attach JWT + device id ──────────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const did = getDeviceId();
  if (did) config.headers["X-Device-Id"] = did;
  return config;
});

// ─── RESPONSE: global error handling ─────────────────────────────────────────
// On 401, dispatch a custom event that AuthContext listens to.
// AuthContext shows a "Session expired" toast before clearing state and redirecting.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      window.dispatchEvent(new CustomEvent("arenaX:session-expired"));
    }
    return Promise.reject(err);
  }
);

export default API;
