import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendRegisterOtp, verifyRegisterOtp, resendRegisterOtp } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { ErrorMessage } from "../components/UI";
import PasswordInput from "../components/PasswordInput"; // FIX M12

// ── Eye icons ─────────────────────────────────────────────────────────────────
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
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="input text-center text-2xl font-mono font-bold"
          style={{ width: 48, height: 56, padding: 0, letterSpacing: 0 }}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

// FIX (medium): accepts a `countKey` prop so the parent can force a full remount
// (and timer reset) when a new OTP is sent. Without this, resending a code left
// the old timer ticking while showing "code expires in X" incorrectly.
function Countdown({ seconds, onExpire, countKey }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); onExpire(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  // countKey in deps causes full re-run whenever a new code is sent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, countKey]);

  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return <span style={{ color: left < 60 ? "var(--red)" : "var(--text-secondary)" }}>{m}:{s}</span>;
}

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [step,     setStep]     = useState("form");
  const [form,     setForm]     = useState({ username: "", email: "", password: "" });
  const [otp,      setOtp]      = useState("");
  const [agreed,   setAgreed]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [expired,  setExpired]  = useState(false);
  const [resendOk, setResendOk] = useState(false);
  // FIX (medium): countKey increments on each resend, causing Countdown to remount
  // and restart from 600s with the new code's expiry window.
  const [countKey, setCountKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(60);


  useEffect(() => {
    if (step !== "otp" || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!agreed) return setError("You must agree to the Terms & Conditions and Privacy Policy.");
    setLoading(true); setError("");
    try {
      await sendRegisterOtp(form);
      setStep("otp");
      setExpired(false);
      setCountKey(0);
      setResendCooldown(60);
    } catch (err) {
      const errs = err.response?.data?.errors;
      setError(errs ? errs[0]?.message : err.response?.data?.message || "Failed to send code");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError("Enter all 6 digits");
    setLoading(true); setError("");
    try {
      const res = await verifyRegisterOtp({ email: form.email, otp });
      login(res.data.user, res.data.token);
      navigate("/games");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
      setOtp("");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true); setError(""); setResendOk(false);
    try {
      await resendRegisterOtp({ email: form.email });
      setExpired(false);
      setOtp("");
      setResendOk(true);
      // FIX: increment countKey to force Countdown remount with fresh 600s window
      setCountKey((k) => k + 1);
      setResendCooldown(60);
      setTimeout(() => setResendOk(false), 4000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend");
    } finally { setLoading(false); }
  };

  const requirements = [
    { label: "8+ characters", met: form.password.length >= 8 },
    { label: "One uppercase", met: /[A-Z]/.test(form.password) },
    { label: "One number",    met: /[0-9]/.test(form.password) },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">

        {step === "form" && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                Join ArenaX
              </h1>
              <p className="text-gray-400">Create your Player Card</p>
            </div>

            <div className="card">
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <ErrorMessage message={error} />

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
                  <input name="username" placeholder="your_gamertag" value={form.username}
                    onChange={handleChange} required autoComplete="username" className="input" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                  <input name="email" type="email" placeholder="you@example.com" value={form.email}
                    onChange={handleChange} required autoComplete="email" className="input" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                  <PasswordInput
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  {form.password.length > 0 && (
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

                <label className="flex items-start gap-3 cursor-pointer mt-1">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input type="checkbox" checked={agreed}
                      onChange={(e) => { setAgreed(e.target.checked); setError(""); }}
                      className="sr-only" />
                    <div className="w-4 h-4 rounded border flex items-center justify-center transition-all"
                      style={{ background: agreed ? "#ff4655" : "transparent", borderColor: agreed ? "#ff4655" : "var(--border-color)" }}>
                      {agreed && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer"
                      className="font-medium hover:underline" style={{ color: "#ff4655" }}
                      onClick={(e) => e.stopPropagation()}>Terms &amp; Conditions</Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer"
                      className="font-medium hover:underline" style={{ color: "#ff4655" }}
                      onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>
                    . I confirm I am at least 13 years old.
                  </span>
                </label>

                <button type="submit" disabled={loading}
                  className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Sending code..." : "Continue"}
                </button>
              </form>
            </div>

            <p className="text-center text-gray-500 text-sm mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-red hover:text-red-light font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </>
        )}

        {step === "otp" && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
                Verify Email
              </h1>
              <p className="text-gray-400">
                We sent a 6-digit code to{" "}
                <span className="text-white font-medium">{form.email}</span>
              </p>
            </div>

            <div className="card">
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <ErrorMessage message={error} />

                {resendOk && (
                  <div className="text-sm text-green-400 text-center py-2 rounded-lg"
                    style={{ background: "rgba(74,222,128,0.08)" }}>
                    ✓ New code sent — check your inbox
                  </div>
                )}

                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Enter verification code
                  </label>
                  <OtpInput value={otp} onChange={setOtp} />

                  {!expired && (
                    <div className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
                      Code expires in{" "}
                      {/* FIX: key={countKey} forces full remount so timer restarts when resend is called */}
                      <Countdown key={countKey} countKey={countKey} seconds={600} onExpire={() => setExpired(true)} />
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
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>

                {!expired && (
                  <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    {resendCooldown > 0 ? (
                      <>Resend available in <span style={{ color: "#ff4655" }}>{resendCooldown}s</span></>
                    ) : (
                      <>
                        Didn't receive it?{" "}
                        <button type="button" onClick={handleResend} disabled={loading}
                          className="font-medium hover:underline disabled:opacity-50"
                          style={{ color: "#ff4655" }}>
                          Resend code
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                  className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  ← Change email or details
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
