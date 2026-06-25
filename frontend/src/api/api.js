import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

// ─── REQUEST: attach JWT ──────────────────────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── RESPONSE: global error handling ─────────────────────────────────────────
// FIX M8: Instead of silently redirecting on 401 (which looked like a crash to
// users mid-action), we now dispatch a custom event that AuthContext listens to.
// AuthContext shows a "Session expired" toast before clearing state and redirecting.
// This gives users feedback instead of a jarring, unexplained logout.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      // Dispatch a named event — AuthContext handles the toast + logout + redirect
      window.dispatchEvent(new CustomEvent("arenaX:session-expired"));
    }
    return Promise.reject(err);
  }
);

export default API;
