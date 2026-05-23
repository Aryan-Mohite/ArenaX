import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { generateToken } from "../utils/jwt.js";
import { generateOtp, compareOtp } from "../utils/otp.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../utils/mailer.js";

const SALT_ROUNDS = 12;
const OTP_TTL_MS  = 10 * 60 * 1000; // 10 minutes

// ─── STEP 1: SEND REGISTRATION OTP ───────────────────────────────────────────
// POST /api/auth/register/send-otp
// Body: { username, email, password }
// Validates credentials, stores them pending OTP verification, emails the OTP.
export const sendRegisterOtp = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check duplicates before storing anything
    const existing = await pool.query(
      "SELECT user_id, email, username FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existing.rows.length > 0) {
      const row   = existing.rows[0];
      const field = row.email === email ? "email" : "username";
      return res.status(409).json({
        success: false,
        message: `That ${field} is already registered`,
      });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const otp           = generateOtp();
    const expires_at    = new Date(Date.now() + OTP_TTL_MS);

    // Upsert into pending_verifications — old entry replaced if user retries
    await pool.query(
      `INSERT INTO pending_verifications (email, username, password_hash, otp, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET username      = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             otp           = EXCLUDED.otp,
             expires_at    = EXCLUDED.expires_at,
             attempts      = 0`,
      [email, username, password_hash, otp, expires_at]
    );

    await sendOtpEmail(email, otp);

    res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (err) {
    next(err);
  }
};

// ─── STEP 2: VERIFY OTP & CREATE ACCOUNT ─────────────────────────────────────
// POST /api/auth/register/verify
// Body: { email, otp }
export const verifyRegisterOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const result = await pool.query(
      "SELECT * FROM pending_verifications WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending verification for this email. Please register again.",
      });
    }

    const pending = result.rows[0];

    // Expiry check
    if (new Date() > new Date(pending.expires_at)) {
      await pool.query("DELETE FROM pending_verifications WHERE email = $1", [email]);
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please register again.",
      });
    }

    // Brute-force guard: max 5 wrong attempts
    if (pending.attempts >= 5) {
      await pool.query("DELETE FROM pending_verifications WHERE email = $1", [email]);
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Please register again.",
      });
    }

    if (!compareOtp(otp, pending.otp)) {
      await pool.query(
        "UPDATE pending_verifications SET attempts = attempts + 1 WHERE email = $1",
        [email]
      );
      const remaining = 5 - (pending.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    // OTP correct — create the real user account
    const insertResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, email_verified)
       VALUES ($1, $2, $3, true)
       RETURNING user_id, username, email, created_at`,
      [pending.username, pending.email, pending.password_hash]
    );

    // Clean up the pending row
    await pool.query("DELETE FROM pending_verifications WHERE email = $1", [email]);

    const user  = insertResult.rows[0];
    const token = generateToken({ id: user.user_id, username: user.username, isAdmin: false });

    res.status(201).json({
      success: true,
      message: "Email verified — welcome to ArenaX!",
      token,
      user: { ...user, isAdmin: false },
    });
  } catch (err) {
    next(err);
  }
};

// ─── RESEND REGISTRATION OTP ──────────────────────────────────────────────────
// POST /api/auth/register/resend-otp
// Body: { email }
export const resendRegisterOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      "SELECT * FROM pending_verifications WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending verification for this email. Please register again.",
      });
    }

    const otp        = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
      `UPDATE pending_verifications
         SET otp = $1, expires_at = $2, attempts = 0
       WHERE email = $3`,
      [otp, expires_at, email]
    );

    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "New verification code sent" });
  } catch (err) {
    next(err);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT user_id, username, email, password_hash, status, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (user.status === "banned") {
      return res.status(403).json({ success: false, message: "Account is banned" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id]
    );

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(user.email.toLowerCase());
    const token   = generateToken({ id: user.user_id, username: user.username, isAdmin });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        isAdmin,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET CURRENT USER (me) ────────────────────────────────────────────────────
// GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT user_id, username, email, profile_picture, country, region,
              bio, status, created_at, last_login
       FROM users
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isAdmin = req.user.isAdmin === true;
    res.json({ success: true, user: { ...result.rows[0], isAdmin } });
  } catch (err) {
    next(err);
  }
};

// ─── FORGOT PASSWORD — SEND OTP ───────────────────────────────────────────────
// POST /api/auth/forgot-password
// Body: { email }
// Always returns 200 to prevent user enumeration.
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      "SELECT user_id FROM users WHERE email = $1 AND status != 'banned'",
      [email]
    );

    // Respond success regardless of whether email exists (prevents enumeration)
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "If that email is registered, a reset code has been sent.",
      });
    }

    const otp        = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    // Upsert into password_resets table
    await pool.query(
      `INSERT INTO password_resets (email, otp, expires_at, attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (email) DO UPDATE
         SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at, attempts = 0`,
      [email, otp, expires_at]
    );

    await sendPasswordResetEmail(email, otp);

    res.json({
      success: true,
      message: "If that email is registered, a reset code has been sent.",
    });
  } catch (err) {
    next(err);
  }
};

// ─── FORGOT PASSWORD — VERIFY OTP ─────────────────────────────────────────────
// POST /api/auth/forgot-password/verify
// Body: { email, otp }
// Returns a short-lived reset token if the OTP is valid.
export const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const result = await pool.query(
      "SELECT * FROM password_resets WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "No reset request found for this email." });
    }

    const reset = result.rows[0];

    if (new Date() > new Date(reset.expires_at)) {
      await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);
      return res.status(400).json({ success: false, message: "Reset code has expired. Please try again." });
    }

    if (reset.attempts >= 5) {
      await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new code." });
    }

    if (!compareOtp(otp, reset.otp)) {
      await pool.query(
        "UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1",
        [email]
      );
      const remaining = 5 - (reset.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    // Mark OTP as verified and issue a short-lived reset token
    // We reuse the otp column to store a verified marker so the next step can proceed
    await pool.query(
      "UPDATE password_resets SET verified = true WHERE email = $1",
      [email]
    );

    res.json({ success: true, message: "Code verified. You may now set a new password." });
  } catch (err) {
    next(err);
  }
};

// ─── FORGOT PASSWORD — SET NEW PASSWORD ───────────────────────────────────────
// POST /api/auth/forgot-password/reset
// Body: { email, otp, newPassword }
export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    const result = await pool.query(
      "SELECT * FROM password_resets WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0 || !result.rows[0].verified) {
      return res.status(400).json({ success: false, message: "Please verify your reset code first." });
    }

    const reset = result.rows[0];

    if (new Date() > new Date(reset.expires_at)) {
      await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);
      return res.status(400).json({ success: false, message: "Reset session expired. Please start over." });
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2",
      [password_hash, email]
    );

    await pool.query("DELETE FROM password_resets WHERE email = $1", [email]);

    res.json({ success: true, message: "Password updated successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
};
