import crypto from "crypto";
import pool from "../config/db.js";
import { hashApiKey } from "../middleware/apiKeyAuth.js";

const MAX_ACTIVE_KEYS = 5;

// ─── KEY MANAGEMENT (Organization tier, session-authenticated) ──────────────

// GET /api/organizers/api-keys
export const listApiKeys = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT key_id, label, key_prefix, last_used_at, revoked_at, created_at
         FROM organizer_api_keys
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, keys: rows });
  } catch (err) { next(err); }
};

// POST /api/organizers/api-keys  { label? }
// The raw key is returned ONCE here and never stored.
export const createApiKey = async (req, res, next) => {
  try {
    const label = (req.body?.label || "Default").toString().trim().slice(0, 60) || "Default";

    const [[{ active }]] = await pool.query(
      "SELECT COUNT(*) AS active FROM organizer_api_keys WHERE user_id = ? AND revoked_at IS NULL",
      [req.user.id]
    );
    if (Number(active) >= MAX_ACTIVE_KEYS) {
      return res.status(400).json({
        success: false,
        message: `You can have at most ${MAX_ACTIVE_KEYS} active keys — revoke one first.`,
      });
    }

    const raw = `axk_${crypto.randomBytes(24).toString("hex")}`;
    const [result] = await pool.query(
      `INSERT INTO organizer_api_keys (user_id, label, key_prefix, key_hash)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, label, raw.slice(0, 8), hashApiKey(raw)]
    );

    res.status(201).json({
      success: true,
      key: { key_id: result.insertId, label, key_prefix: raw.slice(0, 8), secret: raw },
      message: "Copy this key now — it won't be shown again.",
    });
  } catch (err) { next(err); }
};

// DELETE /api/organizers/api-keys/:id  (revokes; row kept for audit)
export const revokeApiKey = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE organizer_api_keys SET revoked_at = NOW()
        WHERE key_id = ? AND user_id = ? AND revoked_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No active key with that id" });
    }
    res.json({ success: true, message: "Key revoked" });
  } catch (err) { next(err); }
};

// ─── PUBLIC READ-ONLY API (/api/v1, API-key-authenticated) ──────────────────

// GET /api/v1/tournaments
export const apiListTournaments = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.tournament_id, t.name, t.status, t.max_teams, t.is_inter_college,
              g.game_name, COUNT(tr.registration_id) AS registered_teams
         FROM tournaments t
         JOIN games g ON g.game_id = t.game_id
         LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
        WHERE t.created_by = ?
        GROUP BY t.tournament_id, g.game_name
        ORDER BY t.created_at DESC`,
      [req.apiUser.id]
    );
    res.json({
      success: true,
      tournaments: rows.map((r) => ({
        ...r,
        registered_teams: Number(r.registered_teams),
        is_inter_college: !!r.is_inter_college,
      })),
    });
  } catch (err) { next(err); }
};

// GET /api/v1/tournaments/:id/registrations
// Team-level data only — no player emails or other personal details.
export const apiTournamentRegistrations = async (req, res, next) => {
  try {
    const [[t]] = await pool.query(
      "SELECT tournament_id, name FROM tournaments WHERE tournament_id = ? AND created_by = ?",
      [req.params.id, req.apiUser.id]
    );
    if (!t) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const [rows] = await pool.query(
      `SELECT tr.registration_id, tr.status, tr.registered_at, tm.team_id, tm.team_name
         FROM tournament_registrations tr
         JOIN teams tm ON tm.team_id = tr.team_id
        WHERE tr.tournament_id = ?
        ORDER BY tr.registered_at ASC`,
      [t.tournament_id]
    );
    res.json({ success: true, tournament: t, registrations: rows });
  } catch (err) { next(err); }
};
