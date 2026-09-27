import pool from "../config/db.js";

// ─── REPORT A USER ───────────────────────────────────────────────────────────
// POST /api/reports/user/:userId  { reason, category? }
export const reportUser = async (req, res, next) => {
  try {
    const { userId: reportedUserId } = req.params;
    const { reason, category } = req.body;
    const reporterId = req.user.id;

    if (Number(reportedUserId) === reporterId) {
      return res.status(400).json({ success: false, message: "You can't report yourself" });
    }

    const [[target]] = await pool.query("SELECT user_id FROM users WHERE user_id = ?", [reportedUserId]);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [result] = await pool.query(
      "INSERT INTO reports (reported_user, reported_by, reason, category) VALUES (?, ?, ?, ?)",
      [reportedUserId, reporterId, reason, category || null]
    );
    res.status(201).json({ success: true, report_id: result.insertId, message: "Report submitted" });
  } catch (err) { next(err); }
};

// ─── REPORT A TOURNAMENT (§9: organizer-side abuse) ─────────────────────────
// POST /api/reports/tournament/:tournamentId  { reason, category? }
// category is expected to be something like 'fake_tournament' or 'no_show' —
// not enforced as an enum in the DB (VARCHAR, same looseness as `status`
// columns elsewhere in this codebase), just documented here and on the
// frontend's picker.
export const reportTournament = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const { reason, category } = req.body;
    const reporterId = req.user.id;

    const [[tournament]] = await pool.query(
      "SELECT tournament_id FROM tournaments WHERE tournament_id = ?",
      [tournamentId]
    );
    if (!tournament) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const [result] = await pool.query(
      "INSERT INTO reports (reported_tournament_id, reported_by, reason, category) VALUES (?, ?, ?, ?)",
      [tournamentId, reporterId, reason, category || null]
    );
    res.status(201).json({ success: true, report_id: result.insertId, message: "Report submitted" });
  } catch (err) { next(err); }
};
