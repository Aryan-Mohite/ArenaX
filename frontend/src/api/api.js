import axios from "axios";

// In production: same origin (/api), Vite dev proxy handles /api → localhost:5000
const API = axios.create({
  baseURL: "/api",
});

// ─── REQUEST: attach JWT ──────────────────────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
