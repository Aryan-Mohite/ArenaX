import nodemailer from "nodemailer";

/**
 * mailer.js
 *
 * FIX: Transporter is now created lazily on first use, not at module load time.
 *
 * Previously, createTransporter() was called immediately when the module was
 * imported. If SMTP_HOST/USER/PASS are missing or set to placeholder values
 * (e.g. "CHANGE_ME"), the throw inside createTransporter() would propagate up
 * and crash EVERY request — including login — because Node caches failed module
 * initialisation. The server appeared to start fine but all routes crashed with
 * a 500 because the mailer import chain was broken.
 *
 * Fix: build the transporter inside each send function (or lazily on first call)
 * so a missing SMTP config only breaks email routes, not the whole app.
 */

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass ||
      host === "CHANGE_ME" || user === "CHANGE_ME" || pass === "CHANGE_ME") {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

// Lazy singleton — created once on first email send, then reused
let _transporter = null;
const transporter = () => {
  if (!_transporter) _transporter = getTransporter();
  return _transporter;
};

const FROM = (name = "ArenaX") =>
  `"${name}" <${process.env.SMTP_USER}>`;

// ─── OTP EMAIL ────────────────────────────────────────────────────────────────
export const sendOtpEmail = async (to, otp) => {
  await transporter().sendMail({
    from: FROM("ArenaX — Verify Email"),
    to,
    subject: "Your ArenaX verification code",
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#ff4655;padding:24px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:1px">ArenaX</h1>
        </div>
        <div style="padding:32px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#fff">Verify your email</h2>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">
            Enter this 6-digit code to complete your registration. It expires in <strong style="color:#fff">10 minutes</strong>.
          </p>
          <div style="background:#1a2340;border:1px solid #1e2d4a;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#ff4655;font-family:monospace">${otp}</span>
          </div>
          <p style="margin:0;color:#475569;font-size:12px">
            If you didn't create an ArenaX account, ignore this email.
          </p>
        </div>
      </div>
    `,
  });
};

// ─── PASSWORD RESET EMAIL ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (to, otp) => {
  await transporter().sendMail({
    from: FROM("ArenaX — Password Reset"),
    to,
    subject: "Reset your ArenaX password",
    text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request a reset, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#ff4655;padding:24px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff;letter-spacing:1px">ArenaX</h1>
        </div>
        <div style="padding:32px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#fff">Reset your password</h2>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">
            Use this code to reset your password. It expires in <strong style="color:#fff">10 minutes</strong>.
          </p>
          <div style="background:#1a2340;border:1px solid #1e2d4a;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#ff4655;font-family:monospace">${otp}</span>
          </div>
          <p style="margin:0;color:#475569;font-size:12px">
            If you didn't request a password reset, you can safely ignore this email — your account is unchanged.
          </p>
        </div>
      </div>
    `,
  });
};
