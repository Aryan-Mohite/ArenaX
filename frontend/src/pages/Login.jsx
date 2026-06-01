import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { ErrorMessage } from "../components/UI";
import PasswordInput from "../components/PasswordInput"; // FIX M12: extracted shared component

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginUser(form);
      login(res.data.user, res.data.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
            Welcome back
          </h1>
          <p className="text-gray-400">Report for Duty</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ErrorMessage message={error} />

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <PasswordInput
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <div className="text-right mt-1.5">
                {/* FIX (info): was <a href="/forgot-password"> causing a full page reload.
                    React Router's Link enables client-side navigation. */}
                <Link
                  to="/forgot-password"
                  className="text-xs hover:underline transition-colors"
                  style={{ color: "var(--red)" }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Deploying..." : "Deploy"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-red hover:text-red-light font-medium transition-colors">
            Create one free
          </Link>
        </p>

        <div className="flex justify-center gap-4 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link to="/terms" className="hover:underline transition-colors" style={{ color: "var(--text-muted)" }}>
            Terms &amp; Conditions
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:underline transition-colors" style={{ color: "var(--text-muted)" }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
