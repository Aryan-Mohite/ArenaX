import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import API from "../api/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );

  // FIX M8: session-expiry toast state
  const [sessionExpiredToast, setSessionExpiredToast] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  // On mount: if we have a token, re-verify it against /auth/me.
  // This ensures isAdmin reflects server ground truth, not a stale localStorage value.
  useEffect(() => {
    if (!token) return;
    API.get("/auth/me")
      .then((res) => {
        if (res.data?.user) {
          const raw = res.data.user;
          const serverUser = { ...raw, id: raw.id ?? raw.user_id };
          setUser(serverUser);
          localStorage.setItem("user", JSON.stringify(serverUser));
        }
      })
      .catch(() => {
        clearSession();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX M8: Listen for the session-expired event dispatched by api.js interceptor.
  // Shows a visible toast for 3 seconds, then logs out and redirects to /login.
  // Previously the user was silently redirected with no feedback.
  useEffect(() => {
    const handleExpiry = () => {
      setSessionExpiredToast(true);
      setTimeout(() => {
        setSessionExpiredToast(false);
        clearSession();
        window.location.href = "/login";
      }, 3000);
    };
    window.addEventListener("arenaX:session-expired", handleExpiry);
    return () => window.removeEventListener("arenaX:session-expired", handleExpiry);
  }, [clearSession]);

  const login = useCallback((userData, authToken) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {/* FIX M8: Session-expired notification toast */}
      {sessionExpiredToast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99999,
            background: "#1e293b",
            border: "1px solid #f97316",
            color: "#f1f5f9",
            padding: "14px 24px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "#f97316" }}>⚠️</span>
          Your session has expired — redirecting to login…
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
