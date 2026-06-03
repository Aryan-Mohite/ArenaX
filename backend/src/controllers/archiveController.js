/**
 * archiveController.js — MySQL version
 *
 * Key changes from PostgreSQL:
 *  • pool.connect()         → pool.getConnection()
 *  • client.query("BEGIN")  → conn.beginTransaction()
 *  • client.query("COMMIT") → conn.commit()
 *  • client.query("ROLLBACK")→ conn.rollback()
 *  • $1,$2…                 → ?
 *  • result.rows            → rows  (destructured from [rows] = await pool.query())
 *  • SELECT fn_restore_*()  → CALL fn_restore_*(…)
 *  • SELECT * FROM fn_purge_old_archives() → CALL fn_purge_old_archives()
 */

import pool from "../config/db.js";
import { invalidateAuthCache } from "../config/db.js";

// =============================================================================
// Helpers
// =============================================================================

const writeAuditLog = async (conn, { entity_type, entity_id, entity_name, archived_by, archive_reason }) => {
  await conn.query(
    `INSERT INTO archive_audit_log (entity_type, entity_id, entity_name, archived_by, archive_reason)
     VALUES (?, ?, ?, ?, ?)`,
    [entity_type, entity_id, entity_name ?? null, archived_by ?? null, archive_reason ?? "user_deleted"]
  );
};

// =============================================================================
// ARCHIVE-AWARE DELETE ENDPOINTS
// =============================================================================

// ── DELETE TOURNAMENT ─────────────────────────────────────────────────────────
export const deleteTournament = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      "SELECT tournament_id, name, created_by FROM tournaments WHERE tournament_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const { name, created_by } = rows[0];
    if (created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    await conn.beginTransaction();
    await conn.query("DELETE FROM tournaments WHERE tournament_id = ?", [id]);
    await writeAuditLog(conn, {
      entity_type: "tournament", entity_id: Number(id), entity_name: name,
      archived_by: userId, archive_reason: req.body?.reason ?? "user_deleted",
    });
    await conn.commit();

    res.json({ success: true, message: `Tournament "${name}" archived successfully.` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── DELETE TEAM ───────────────────────────────────────────────────────────────
export const deleteTeam = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      `SELECT t.team_id, t.team_name, tm.role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = ?
       WHERE t.team_id = ?`,
      [userId, id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Team not found or you are not a member" });
    if (rows[0].role !== "captain" && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the captain can disband the team" });

    const { team_name } = rows[0];

    await conn.beginTransaction();
    await conn.query("DELETE FROM teams WHERE team_id = ?", [id]);
    await writeAuditLog(conn, {
      entity_type: "team", entity_id: Number(id), entity_name: team_name,
      archived_by: userId, archive_reason: req.body?.reason ?? "user_deleted",
    });
    await conn.commit();

    res.json({ success: true, message: `Team "${team_name}" archived and disbanded.` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── DELETE STREAM ─────────────────────────────────────────────────────────────
export const deleteStream = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      "SELECT stream_id, title, user_id FROM streams WHERE stream_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Stream not found" });
    if (rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const { title } = rows[0];

    await conn.beginTransaction();
    await conn.query("DELETE FROM streams WHERE stream_id = ?", [id]);
    await writeAuditLog(conn, {
      entity_type: "stream", entity_id: Number(id), entity_name: title,
      archived_by: userId, archive_reason: req.body?.reason ?? "user_deleted",
    });
    await conn.commit();

    res.json({ success: true, message: `Stream "${title}" archived.` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── DELETE COMMUNITY POST ─────────────────────────────────────────────────────
export const deleteCommunityPost = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      "SELECT post_id, title, user_id FROM community_posts WHERE post_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });
    if (rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const { title } = rows[0];

    await conn.beginTransaction();
    await conn.query("DELETE FROM community_posts WHERE post_id = ?", [id]);
    await writeAuditLog(conn, {
      entity_type: "community_post", entity_id: Number(id), entity_name: title,
      archived_by: userId, archive_reason: req.body?.reason ?? "user_deleted",
    });
    await conn.commit();

    res.json({ success: true, message: "Post archived." });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── DELETE TEAM FINDER POST ───────────────────────────────────────────────────
export const deleteTeamFinderPost = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      "SELECT post_id, user_id, rank_required, role_required FROM team_finder_posts WHERE post_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });
    if (rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const label = `${rows[0].role_required} / ${rows[0].rank_required}`;

    await conn.beginTransaction();
    await conn.query("DELETE FROM team_finder_posts WHERE post_id = ?", [id]);
    await writeAuditLog(conn, {
      entity_type: "team_finder_post", entity_id: Number(id), entity_name: label,
      archived_by: userId, archive_reason: req.body?.reason ?? "user_deleted",
    });
    await conn.commit();

    res.json({ success: true, message: "Team finder post archived." });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── SOFT DELETE MY ACCOUNT ────────────────────────────────────────────────────
export const softDeleteMyAccount = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;

    await conn.beginTransaction();

    // FIX BUG-5: username VARCHAR(50) + "_deleted_" + id could overflow.
    // LEFT() caps the base so the total never exceeds the column width.
    // username: max 50 chars → LEFT(username, 40) + "_deleted_" (9) + id (≤10) = 59 — fits in VARCHAR(60).
    // email: max 100 chars → LEFT(email, 80) + "_deleted_" (9) + id (≤10) = 99 — fits in VARCHAR(120).
    // (Schema column widths are expanded to VARCHAR(60)/VARCHAR(120) — see arenaX_schema_mysql.sql)
    await conn.query(
      `UPDATE users
       SET status   = 'deleted',
           username = CONCAT(LEFT(username, 40), '_deleted_', user_id),
           email    = CONCAT(LEFT(email,    80), '_deleted_', user_id)
       WHERE user_id = ?`,
      [userId]
    );

    const [userRows] = await conn.query(
      "SELECT user_id, username, email, country FROM users WHERE user_id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { username, email, country } = userRows[0];
    await conn.query(
      `INSERT INTO deleted_users_log (user_id, username, email, country, deleted_by, delete_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username, email, country, userId, req.body?.reason ?? "user_self_deleted"]
    );

    await conn.commit();

    // FIX LAG-3: evict from auth cache immediately so the now-deleted user
    // cannot make further authenticated requests within the cache TTL window.
    invalidateAuthCache(userId);

    res.json({ success: true, message: "Account deactivated. Your data is retained for 365 days." });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// =============================================================================
// ADMIN — LIST, INSPECT, RESTORE, AUDIT, PURGE
// =============================================================================

// ── LIST ARCHIVES ─────────────────────────────────────────────────────────────
export const listArchives = async (req, res, next) => {
  try {
    const { entity_type, limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);
    const params = [];
    let where = "";

    if (entity_type) {
      params.push(entity_type);
      where = "WHERE aal.entity_type = ?";
    }
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT aal.log_id, aal.entity_type, aal.entity_id, aal.entity_name,
              aal.archived_at, aal.archive_reason, aal.restored_at,
              u.username AS archived_by_user
       FROM archive_audit_log aal
       LEFT JOIN users u ON u.user_id = aal.archived_by
       ${where}
       ORDER BY aal.archived_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    res.json({ success: true, archives: rows });
  } catch (err) { next(err); }
};

// ── GET SINGLE ARCHIVED ITEM ──────────────────────────────────────────────────
export const getArchivedItem = async (req, res, next) => {
  try {
    const { entity, id } = req.params;

    const tableMap = {
      tournament:       { table: "archive_tournaments",       col: "tournament_id" },
      team:             { table: "archive_teams",             col: "team_id"       },
      stream:           { table: "archive_streams",           col: "stream_id"     },
      community_post:   { table: "archive_community_posts",   col: "post_id"       },
      team_finder_post: { table: "archive_team_finder_posts", col: "post_id"       },
      match:            { table: "archive_matches",           col: "match_id"      },
    };

    const map = tableMap[entity];
    if (!map) return res.status(400).json({ success: false, message: `Unknown entity type: ${entity}` });

    const [rows] = await pool.query(
      `SELECT * FROM ${map.table} WHERE ${map.col} = ? ORDER BY archived_at DESC LIMIT 1`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Archived item not found" });

    res.json({ success: true, archived_item: rows[0] });
  } catch (err) { next(err); }
};

// ── RESTORE TOURNAMENT ────────────────────────────────────────────────────────
export const restoreTournament = async (req, res, next) => {
  try {
    await pool.query("CALL fn_restore_tournament(?, ?)", [req.params.id, req.user.id]);
    res.json({ success: true, message: `Tournament ${req.params.id} restored. Status reset to 'upcoming'.` });
  } catch (err) { next(err); }
};

// ── RESTORE TEAM ──────────────────────────────────────────────────────────────
export const restoreTeam = async (req, res, next) => {
  try {
    await pool.query("CALL fn_restore_team(?, ?)", [req.params.id, req.user.id]);
    res.json({ success: true, message: `Team ${req.params.id} restored. Members must be re-invited.` });
  } catch (err) { next(err); }
};

// ── RESTORE STREAM ────────────────────────────────────────────────────────────
export const restoreStream = async (req, res, next) => {
  try {
    await pool.query("CALL fn_restore_stream(?, ?)", [req.params.id, req.user.id]);
    res.json({ success: true, message: `Stream ${req.params.id} restored as 'ended'.` });
  } catch (err) { next(err); }
};

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
export const getAuditLog = async (req, res, next) => {
  try {
    const { entity_type, from_date, to_date, limit: _rawLimit = 100, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);
    const conditions = [];
    const params = [];

    if (entity_type) { params.push(entity_type); conditions.push("aal.entity_type = ?"); }
    if (from_date)   { params.push(from_date);   conditions.push("aal.archived_at >= ?"); }
    if (to_date)     { params.push(to_date);     conditions.push("aal.archived_at <= ?"); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT aal.*,
              u.username  AS archived_by_user,
              ur.username AS restored_by_user
       FROM archive_audit_log aal
       LEFT JOIN users u  ON u.user_id  = aal.archived_by
       LEFT JOIN users ur ON ur.user_id = aal.restored_by
       ${where}
       ORDER BY aal.archived_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    res.json({ success: true, audit_log: rows });
  } catch (err) { next(err); }
};

// ── PURGE OLD ARCHIVES ────────────────────────────────────────────────────────
// MySQL stored procedure returns a result set; mysql2 returns [[rows], fields]
export const purgeOldArchives = async (req, res, next) => {
  try {
    const [resultSets] = await pool.query("CALL fn_purge_old_archives()");
    const purged = Array.isArray(resultSets[0]) ? resultSets[0] : resultSets;
    res.json({ success: true, purged });
  } catch (err) { next(err); }
};