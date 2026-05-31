import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, verifyResetOtp, resetPassword } from "../services/authService";
import { ErrorMessage } from "../components/UI";
import PasswordInput from "../components/PasswordInput"; // FIX M12

// ── Eye icons ─────────────────────────────────────────────────────────────────
// ── Reusable password input with show/hide toggle ─────────────────────────────
// ── OTP boxes ─────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      const next = digits.map((d, idx) => (idx === i ? "" : d));
      onChange(next.join(""));
      if (i > 0 && !digits[i]) inputs.current[i - 1]?.focus();
      return;
    }
    if (e.key === "ArrowLeft"  && i > 0) { inputs.current[i - 1]?.focus(); return; }
    if (e.key === "ArrowRight" && i < 5) { inputs.current[i + 1]?.focus(); return; }
  };
  const handleChange = (i, e) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, idx) => (idx === i ? ch : d));
    onChange(next.join(""));
    if (ch && i < 5) inputs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, "").slice(0, 6)); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center my-2">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (inputs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => handleChange(i, e)} onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="input text-center text-2xl font-mono font-bold"
          style={{ width: 48, height: 56, padding: 0, letterSpacing: 0 }}
          autoFocus={i === 0} />
      ))}
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); onExpire(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return <span style={{ color: left < 60 ? "var(--red)" : "var(--text-secondary)" }}>{m}:{s}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step,     setStep]    = useState("email");
  const [email,    setEmail]   = useState("");
  const [otp,      setOtp]     = useState("");
  const [pass,     setPass]    = useState({ newPassword: "", confirm: "" });
  const [error,    setError]   = useState("");
  const [loading,  setLoading] = useState(false);
  const [expired,  setExpired] = useState(false);
  const [countKey, setCountKey] = useState(0);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await forgotPassword({ email });
      setStep("otp"); setExpired(false);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError("Enter all 6 digits");
    setLoading(true); setError("");
    try {
      await verifyResetOtp({ email, otp });
      setStep("newpass");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid code");
      setOtp("");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setLoading(true); setError("");
    try {
      await forgotPassword({ email });
      setExpired(false); setOtp(""); setCountKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend");
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (pass.newPassword !== pass.confirm) return setError("Passwords do not match");
    setLoading(true); setError("");
    try {
      await resetPassword({ email, newPassword: pass.newPassword });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed");
    } finally { setLoading(false); }
  };

  const requirements = [
    { label: "8+ characters", met: pass.newPassword.length >= 8 },
    { label: "One uppercase",  met: /[A-Z]/.test(pass.newPassword) },
    { label: "One number",     met: /[0-9]/.test(pass.newPassword) },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">

        {/* ── STEP 1: EMAIL ─────────────────────────────────────── */}
        {step === "email" && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                Forgot Password
              </h1>
              <p className="text-gray-400">Enter your email to receive a reset code</p>
            </div>
            <div className="card">
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <ErrorMessage message={error} />
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@example.com" required autoComplete="email" className="input" />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Sending code..." : "Send Reset Code"}
                </button>
              </form>
            </div>
            <p className="text-center text-gray-500 text-sm mt-6">
              Remembered it?{" "}
              <Link to="/login" className="text-red hover:text-red-light font-medium transition-colors">
                Back to login
              </Link>
            </p>
          </>
        )}

        {/* ── STEP 2: OTP ───────────────────────────────────────── */}
        {step === "otp" && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                Enter Code
              </h1>
              <p className="text-gray-400">
                Code sent to <span className="text-white font-medium">{email}</span>
              </p>
            </div>
            <div className="card">
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <ErrorMessage message={error} />
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    6-digit reset code
                  </label>
                  <OtpInput value={otp} onChange={setOtp} />
                  {!expired && (
                    <div className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
                      Expires in <Countdown key={countKey} seconds={600} onExpire={() => setExpired(true)} />
                    </div>
                  )}
                  {expired && (
                    <div className="text-xs mt-3" style={{ color: "var(--red)" }}>
                      Code expired.{" "}
                      <button type="button" onClick={handleResend} disabled={loading}
                        className="font-medium underline disabled:opacity-50">
                        Send new code
                      </button>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={loading || otp.length < 6}
                  className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
                {!expired && (
                  <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    Didn't receive it?{" "}
                    <button type="button" onClick={handleResend} disabled={loading}
                      className="font-medium hover:underline disabled:opacity-50"
                      style={{ color: "#ff4655" }}>
                      Resend code
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                  className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  ← Change email
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── STEP 3: NEW PASSWORD ──────────────────────────────── */}
        {step === "newpass" && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                New Password
              </h1>
              <p className="text-gray-400">Choose a strong password for your account</p>
            </div>
            <div className="card">
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <ErrorMessage message={error} />

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">New password</label>
                  <PasswordInput
                    value={pass.newPassword}
                    onChange={(e) => { setPass((p) => ({ ...p, newPassword: e.target.value })); setError(""); }}
                    autoComplete="new-password"
                  />
                  {pass.newPassword.length > 0 && (
                    <div className="flex gap-3 mt-2">
                      {requirements.map((r) => (
                        <span key={r.label}
                          className={`text-xs flex items-center gap-1 ${r.met ? "text-green-400" : "text-gray-600"}`}>
                          <span>{r.met ? "✓" : "○"}</span> {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm password</label>
                  <PasswordInput
                    value={pass.confirm}
                    onChange={(e) => { setPass((p) => ({ ...p, confirm: e.target.value })); setError(""); }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {pass.confirm.length > 0 && pass.newPassword !== pass.confirm && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--red)" }}>Passwords don't match</p>
                  )}
                </div>

                <button type="submit"
                  disabled={loading || !requirements.every((r) => r.met) || pass.newPassword !== pass.confirm}
                  className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Saving..." : "Save New Password"}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── STEP 4: DONE ──────────────────────────────────────── */}
        {step === "done" && (
          <>
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎮</div>
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                Password Updated
              </h1>
              <p className="text-gray-400">Your password has been reset successfully.</p>
            </div>
            <div className="card text-center">
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                You can now log in with your new password.
              </p>
              <button onClick={() => navigate("/login")} className="btn-primary w-full">
                Go to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
