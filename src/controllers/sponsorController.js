import pool from "../config/db.js";

// ─── APPLY TO BECOME A SPONSOR ───────────────────────────────────────────────
// POST /api/sponsors/apply  { company_name, website?, contact_email?, logo_url? }
// Any authenticated user can apply; nothing changes until an admin approves
// it (see adminController.approveSponsorApplication) — same shape as the
// organizer-verification flow.
export const applyForSponsor = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { company_name, website, contact_email, logo_url } = req.body;

    const [[existing]] = await pool.query(
      "SELECT sponsor_id, status FROM sponsor_profiles WHERE user_id = ?",
      [userId]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          existing.status === "approved"
            ? "You're already an approved sponsor."
            : existing.status === "pending"
            ? "You already have a pending sponsor application."
            : "Your previous sponsor application was rejected. Contact support to reapply.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO sponsor_profiles (user_id, company_name, website, contact_email, logo_url, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, company_name, website || null, contact_email || null, logo_url || null]
    );

    res.status(201).json({
      success: true,
      sponsor_id: result.insertId,
      message: "Sponsor application submitted — an admin will review it shortly.",
    });
  } catch (err) { next(err); }
};

// ─── GET MY SPONSOR PROFILE ──────────────────────────────────────────────────
// GET /api/sponsors/me
export const getMySponsorProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM sponsor_profiles WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ success: true, sponsor: rows[0] || null });
  } catch (err) { next(err); }
};
