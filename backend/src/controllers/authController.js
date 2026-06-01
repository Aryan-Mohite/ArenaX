import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { generateToken } from "../utils/jwt.js";
import { generateOtp, compareOtp } from "../utils/otp.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../utils/mailer.js";

const SALT_ROUNDS        = 12;
const OTP_TTL_MS         = 10 * 60 * 1000;  // 10 minutes
const VERIFY_SESSION_MS  = 5  * 60 * 1000;  // 5-minute window after OTP verified → must reset within this
const RESEND_COOLDOWN_S  = 60;              // minimum seconds between resend requests
const MAX_RESENDS        = 3;              // maximum resends before requiring fresh registration

// ─── STEP 1: SEND REGISTRATION OTP ───────────────────────────────────────────
export const sendRegisterOtp = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const [existing] = await pool.query(
      "SELECT user_id, email, username FROM users WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existing.length > 0) {
      const row   = existing[0];
      const field = row.email === email ? "email" : "username";
      return res.status(409).json({ success: false, message: `That ${field} is already registered` });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const otp           = generateOtp();
    const expires_at    = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
      `INSERT INTO pending_verifications (email, username, password_hash, otp, expires_at, attempts, resend_count, last_resent_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, NULL)
       ON DUPLICATE KEY UPDATE
         username        = VALUES(username),
         password_hash   = VALUES(password_hash),
         otp             = VALUES(otp),
         expires_at      = VALUES(expires_at),
         attempts        = 0,
         resend_count    = 0,
         last_resent_at  = NULL`,
      [email, username, password_hash, otp, expires_at]
    );

    await sendOtpEmail(email, otp);
    res.json({ success: true, message: "Verification code sent to your email" });
  } catch (err) { next(err); }
};

// ─── STEP 2: VERIFY OTP & CREATE ACCOUNT ─────────────────────────────────────
export const verifyRegisterOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM pending_verifications WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "No pending verification for this email. Please register again." });
    }

    const pending = rows[0];

    if (new Date() > new Date(pending.expires_at)) {
      await pool.query("DELETE FROM pending_verifications WHERE email = ?", [email]);
      return res.status(400).json({ success: false, message: "Verification code has expired. Please register again." });
    }

    if (pending.attempts >= 5) {
      await pool.query("DELETE FROM pending_verifications WHERE email = ?", [email]);
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please register again." });
    }

    if (!compareOtp(otp, pending.otp)) {
      await pool.query(
        "UPDATE pending_verifications SET attempts = attempts + 1 WHERE email = ?",
        [email]
      );
      const remaining = 5 - (pending.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO users (username, email, password_hash, email_verified)
       VALUES (?, ?, ?, 1)`,
      [pending.username, pending.email, pending.password_hash]
    );

    const userId = insertResult.insertId;
    const [userRows] = await pool.query(
      "SELECT user_id, username, email, created_at FROM users WHERE user_id = ?",
      [userId]
    );
    const user = userRows[0];

    await pool.query("DELETE FROM pending_verifications WHERE email = ?", [email]);

    const token = generateToken({ id: user.user_id, username: user.username, isAdmin: false });

    res.status(201).json({
      success: true,
      message: "Email verified — welcome to ArenaX!",
      token,
      user: { ...user, isAdmin: false },
    });
  } catch (err) { next(err); }
};

// ─── RESEND REGISTRATION OTP ──────────────────────────────────────────────────
// FIX (high): added resend_count and cooldown enforcement.
// Previously, calling resend also reset attempts=0, giving unlimited OTP attempts.
export const resendRegisterOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM pending_verifications WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "No pending verification for this email. Please register again." });
    }

    const pending = rows[0];

    // FIX: enforce max resends
    if ((pending.resend_count || 0) >= MAX_RESENDS) {
      return res.status(429).json({
        success: false,
        message: "Maximum resend limit reached. Please start registration again.",
      });
    }

    // FIX: enforce cooldown between resends
    if (pending.last_resent_at) {
      const secondsSinceLast = (Date.now() - new Date(pending.last_resent_at).getTime()) / 1000;
      if (secondsSinceLast < RESEND_COOLDOWN_S) {
        const wait = Math.ceil(RESEND_COOLDOWN_S - secondsSinceLast);
        return res.status(429).json({
          success: false,
          message: `Please wait ${wait} seconds before requesting another code.`,
        });
      }
    }

    const otp        = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    // FIX: do NOT reset attempts — resending does not forgive bad guesses
    await pool.query(
      `UPDATE pending_verifications
       SET otp           = ?,
           expires_at    = ?,
           resend_count  = resend_count + 1,
           last_resent_at = NOW()
       WHERE email = ?`,
      [otp, expires_at, email]
    );

    await sendOtpEmail(email, otp);
    res.json({ success: true, message: "New verification code sent" });
  } catch (err) { next(err); }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT user_id, username, email, password_hash, status, email_verified FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = rows[0];

    if (user.status === "banned") {
      return res.status(403).json({ success: false, message: "Account is banned" });
    }

    // FIX (medium): also block deleted accounts from logging in
    if (user.status === "deleted") {
      return res.status(403).json({ success: false, message: "Account no longer exists" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
      [user.user_id]
    );

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(user.email.toLowerCase());
    const token   = generateToken({ id: user.user_id, username: user.username, isAdmin });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.user_id, username: user.username, email: user.email, isAdmin },
    });
  } catch (err) { next(err); }
};

// ─── GET CURRENT USER (me) ────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, username, email, profile_picture, country, region,
              bio, status, created_at, last_login
       FROM users WHERE user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // FIX (high): isAdmin is derived fresh from ADMIN_EMAILS, not the JWT payload.
    // This ensures that /me always returns the ground-truth admin status.
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(rows[0].email.toLowerCase());

    // FIX: normalise shape — login returns { id } but getMe was returning { user_id } only.
    // After page refresh AuthContext calls /me and overwrites the user object, making user.id
    // undefined everywhere. Now we explicitly expose both .id and .user_id so all comparisons work.
    const userRow = rows[0];
    res.json({ success: true, user: { ...userRow, id: userRow.user_id, isAdmin } });
  } catch (err) { next(err); }
};

// ─── FORGOT PASSWORD — SEND OTP ───────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const [rows] = await pool.query(
      "SELECT user_id FROM users WHERE email = ? AND status = 'active'",
      [email]
    );

    // Always return the same message to prevent email enumeration
    if (rows.length === 0) {
      return res.json({ success: true, message: "If that email is registered, a reset code has been sent." });
    }

    const otp        = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
      `INSERT INTO password_resets (email, otp, expires_at, attempts, verified, verified_at)
       VALUES (?, ?, ?, 0, 0, NULL)
       ON DUPLICATE KEY UPDATE
         otp         = VALUES(otp),
         expires_at  = VALUES(expires_at),
         attempts    = 0,
         verified    = 0,
         verified_at = NULL`,
      [email, otp, expires_at]
    );

    await sendPasswordResetEmail(email, otp);
    res.json({ success: true, message: "If that email is registered, a reset code has been sent." });
  } catch (err) { next(err); }
};

// ─── FORGOT PASSWORD — VERIFY OTP ─────────────────────────────────────────────
export const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "No reset request found for this email." });
    }

    const reset = rows[0];

    if (new Date() > new Date(reset.expires_at)) {
      await pool.query("DELETE FROM password_resets WHERE email = ?", [email]);
      return res.status(400).json({ success: false, message: "Reset code has expired. Please try again." });
    }

    if (reset.attempts >= 5) {
      await pool.query("DELETE FROM password_resets WHERE email = ?", [email]);
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new code." });
    }

    if (!compareOtp(otp, reset.otp)) {
      await pool.query(
        "UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?",
        [email]
      );
      const remaining = 5 - (reset.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    // FIX (critical): store verified_at timestamp so resetPassword can enforce
    // a short post-verification window independently of the original expires_at
    await pool.query(
      "UPDATE password_resets SET verified = 1, verified_at = NOW() WHERE email = ?",
      [email]
    );

    res.json({ success: true, message: "Code verified. You may now set a new password." });
  } catch (err) { next(err); }
};

// ─── FORGOT PASSWORD — SET NEW PASSWORD ───────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ?",
      [email]
    );

    if (rows.length === 0 || !rows[0].verified) {
      return res.status(400).json({ success: false, message: "Please verify your reset code first." });
    }

    const reset = rows[0];

    // FIX (critical): check verified_at within VERIFY_SESSION_MS, not the original
    // expires_at. Previously an attacker who verified the OTP had an unlimited window.
    if (!reset.verified_at || (Date.now() - new Date(reset.verified_at).getTime()) > VERIFY_SESSION_MS) {
      await pool.query("DELETE FROM password_resets WHERE email = ?", [email]);
      return res.status(400).json({ success: false, message: "Reset session expired. Please start over." });
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [password_hash, email]
    );

    await pool.query("DELETE FROM password_resets WHERE email = ?", [email]);

    res.json({ success: true, message: "Password updated successfully. You can now log in." });
  } catch (err) { next(err); }
};