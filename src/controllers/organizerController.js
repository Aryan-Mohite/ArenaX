import pool from "../config/db.js";

// ─── REQUEST VERIFICATION ───────────────────────────────────────────────────
// POST /api/organizers/verification-request
// Any authenticated user can request organizer verification (the roadmap's
// phone/email verify + admin-approval queue). Email verification already
// exists (users.email_verified from OTP registration) — this requires that,
// then queues a row for manual admin review.
//
// NOTE: phone verification isn't built — there's no SMS provider wired up
// yet, so this only checks email_verified. Add a phone step here once one
// exists; the queue/approval flow below doesn't need to change.
export const requestVerification = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [[user]] = await pool.query(
      "SELECT email_verified FROM users WHERE user_id = ?",
      [userId]
    );
    if (!user?.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Verify your email before requesting organizer verification.",
      });
    }

    const [[pending]] = await pool.query(
      "SELECT verification_id FROM organizer_verifications WHERE user_id = ? AND status = 'pending' LIMIT 1",
      [userId]
    );
    if (pending) {
      return res.status(409).json({ success: false, message: "You already have a pending verification request." });
    }

    const [[approved]] = await pool.query(
      "SELECT verification_id FROM organizer_verifications WHERE user_id = ? AND status = 'approved' LIMIT 1",
      [userId]
    );
    if (approved) {
      return res.status(409).json({ success: false, message: "You're already a verified organizer." });
    }

    await pool.query(
      "INSERT INTO organizer_verifications (user_id, status) VALUES (?, 'pending')",
      [userId]
    );

    res.status(201).json({ success: true, message: "Verification request submitted — an admin will review it shortly." });
  } catch (err) { next(err); }
};

// ─── GET MY VERIFICATION STATUS ────────────────────────────────────────────
// GET /api/organizers/verification-status
export const getMyVerificationStatus = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT verification_id, status, note, requested_at, reviewed_at
         FROM organizer_verifications
        WHERE user_id = ?
        ORDER BY requested_at DESC
        LIMIT 1`,
      [req.user.id]
    );
    res.json({ success: true, verification: rows[0] || null });
  } catch (err) { next(err); }
};
