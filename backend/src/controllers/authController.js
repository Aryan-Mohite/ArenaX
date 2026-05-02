import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { generateToken } from "../utils/jwt.js";

const SALT_ROUNDS = 12;

// ─── REGISTER ─────────────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if username or email already exists
    const existing = await pool.query(
      "SELECT user_id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existing.rows.length > 0) {
      const taken = existing.rows[0];
      const field = taken.email === email ? "email" : "username";
      return res.status(409).json({
        success: false,
        message: `That ${field} is already registered`,
      });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, username, email, created_at`,
      [username, email, password_hash]
    );

    const user = result.rows[0];
    // New registrations are never admins
    const token = generateToken({ id: user.user_id, username: user.username, isAdmin: false });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: { ...user, isAdmin: false },
    });
  } catch (err) {
    next(err);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT user_id, username, email, password_hash, status FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      // Use the same generic message for both "user not found" and "wrong password"
      // to prevent user enumeration attacks
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

    // Update last_login timestamp
    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id]
    );

    // Derive admin status from ADMIN_EMAILS env var (comma-separated list)
    // Example in .env: ADMIN_EMAILS=you@gmail.com,partner@gmail.com,dev@company.com
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(user.email.toLowerCase());
    const token = generateToken({ id: user.user_id, username: user.username, isAdmin });

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

    // Attach isAdmin so the frontend knows without re-login
    const isAdmin = req.user.isAdmin === true;
    res.json({ success: true, user: { ...result.rows[0], isAdmin } });
  } catch (err) {
    next(err);
  }
};