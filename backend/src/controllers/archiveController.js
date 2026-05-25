/**
 * archiveController.js
 * Place at: src/controllers/archiveController.js
 *
 * Handles archive-aware deletes and admin restore/list endpoints.
 * Triggers in the DB do the actual archiving automatically on DELETE —
 * this controller just wraps deletes in transactions, writes the audit log,
 * and exposes admin restore/inspect endpoints.
 */

import pool from "../config/db.js";

// =============================================================================
// Helpers
// =============================================================================

const writeAuditLog = async (client, { entity_type, entity_id, entity_name, archived_by, archive_reason }) => {
  await client.query(
    `INSERT INTO archive_audit_log (entity_type, entity_id, entity_name, archived_by, archive_reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [entity_type, entity_id, entity_name ?? null, archived_by ?? null, archive_reason ?? "user_deleted"]
  );
};

// =============================================================================
// ARCHIVE-AWARE DELETE ENDPOINTS
// (replace your existing DELETE handlers with these)
// =============================================================================

// ── DELETE TOURNAMENT ─────────────────────────────────────────────────────────
export const deleteTournament = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await client.query(
      `SELECT tournament_id, name, created_by FROM tournaments WHERE tournament_id = $1`,
      [id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const { name, created_by } = check.rows[0];
    if (created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    await client.query("BEGIN");
    // DB trigger fn_archive_tournament fires here automatically
    await client.query(`DELETE FROM tournaments WHERE tournament_id = $1`, [id]);
    await writeAuditLog(client, {
      entity_type:    "tournament",
      entity_id:      Number(id),
      entity_name:    name,
      archived_by:    userId,
      archive_reason: req.body?.reason ?? "user_deleted",
    });
    await client.query("COMMIT");

    res.json({ success: true, message: `Tournament "${name}" archived successfully.` });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── DELETE TEAM ───────────────────────────────────────────────────────────────
export const deleteTeam = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await client.query(
      `SELECT t.team_id, t.team_name, tm.role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $2
       WHERE t.team_id = $1`,
      [id, userId]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: "Team not found or you are not a member" });
    if (check.rows[0].role !== "captain" && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the captain can disband the team" });

    const { team_name } = check.rows[0];

    await client.query("BEGIN");
    await client.query(`DELETE FROM teams WHERE team_id = $1`, [id]);
    await writeAuditLog(client, {
      entity_type:    "team",
      entity_id:      Number(id),
      entity_name:    team_name,
      archived_by:    userId,
      archive_reason: req.body?.reason ?? "user_deleted",
    });
    await client.query("COMMIT");

    res.json({ success: true, message: `Team "${team_name}" archived and disbanded.` });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── DELETE STREAM ─────────────────────────────────────────────────────────────
export const deleteStream = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await client.query(
      `SELECT stream_id, title, user_id FROM streams WHERE stream_id = $1`,
      [id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: "Stream not found" });
    if (check.rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const { title } = check.rows[0];

    await client.query("BEGIN");
    await client.query(`DELETE FROM streams WHERE stream_id = $1`, [id]);
    await writeAuditLog(client, {
      entity_type:    "stream",
      entity_id:      Number(id),
      entity_name:    title,
      archived_by:    userId,
      archive_reason: req.body?.reason ?? "user_deleted",
    });
    await client.query("COMMIT");

    res.json({ success: true, message: `Stream "${title}" archived.` });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── DELETE COMMUNITY POST ─────────────────────────────────────────────────────
export const deleteCommunityPost = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await client.query(
      `SELECT post_id, title, user_id FROM community_posts WHERE post_id = $1`,
      [id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });
    if (check.rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const { title } = check.rows[0];

    await client.query("BEGIN");
    await client.query(`DELETE FROM community_posts WHERE post_id = $1`, [id]);
    await writeAuditLog(client, {
      entity_type:    "community_post",
      entity_id:      Number(id),
      entity_name:    title,
      archived_by:    userId,
      archive_reason: req.body?.reason ?? "user_deleted",
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Post archived." });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── DELETE TEAM FINDER POST ───────────────────────────────────────────────────
export const deleteTeamFinderPost = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await client.query(
      `SELECT post_id, user_id, rank_required, role_required FROM team_finder_posts WHERE post_id = $1`,
      [id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });
    if (check.rows[0].user_id !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised" });

    const label = `${check.rows[0].role_required} / ${check.rows[0].rank_required}`;

    await client.query("BEGIN");
    await client.query(`DELETE FROM team_finder_posts WHERE post_id = $1`, [id]);
    await writeAuditLog(client, {
      entity_type:    "team_finder_post",
      entity_id:      Number(id),
      entity_name:    label,
      archived_by:    userId,
      archive_reason: req.body?.reason ?? "user_deleted",
    });
    await client.query("COMMIT");

    res.json({ success: true, message: "Team finder post archived." });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── SOFT DELETE MY ACCOUNT ────────────────────────────────────────────────────
export const softDeleteMyAccount = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE users
       SET status   = 'deleted',
           username = username || '_deleted_' || user_id,
           email    = email    || '_deleted_' || user_id
       WHERE user_id = $1
       RETURNING user_id, username, email, country`,
      [userId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const { username, email, country } = result.rows[0];
    await client.query(
      `INSERT INTO deleted_users_log (user_id, username, email, country, deleted_by, delete_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, username, email, country, userId, req.body?.reason ?? "user_self_deleted"]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Account deactivated. Your data is retained for 365 days." });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// =============================================================================
// ADMIN — LIST, INSPECT, RESTORE, AUDIT, PURGE
// =============================================================================

// ── LIST ARCHIVES (all entity types, paginated) ───────────────────────────────
export const listArchives = async (req, res, next) => {
  try {
    const { entity_type, limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);
    const params = [];
    let where = "";

    if (entity_type) {
      params.push(entity_type);
      where = `WHERE aal.entity_type = $${params.length}`;
    }
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT aal.log_id, aal.entity_type, aal.entity_id, aal.entity_name,
              aal.archived_at, aal.archive_reason, aal.restored_at,
              u.username AS archived_by_user
       FROM archive_audit_log aal
       LEFT JOIN users u ON u.user_id = aal.archived_by
       ${where}
       ORDER BY aal.archived_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, archives: result.rows });
  } catch (err) {
    next(err);
  }
};

// ── GET SINGLE ARCHIVED ITEM ──────────────────────────────────────────────────
export const getArchivedItem = async (req, res, next) => {
  try {
    const { entity, id } = req.params;

    const tableMap = {
      tournament:        { table: "archive_tournaments",       col: "tournament_id" },
      team:              { table: "archive_teams",             col: "team_id"       },
      stream:            { table: "archive_streams",           col: "stream_id"     },
      community_post:    { table: "archive_community_posts",   col: "post_id"       },
      team_finder_post:  { table: "archive_team_finder_posts", col: "post_id"       },
      match:             { table: "archive_matches",           col: "match_id"      },
    };

    const map = tableMap[entity];
    if (!map)
      return res.status(400).json({ success: false, message: `Unknown entity type: ${entity}` });

    const result = await pool.query(
      `SELECT * FROM ${map.table} WHERE ${map.col} = $1 ORDER BY archived_at DESC LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Archived item not found" });

    res.json({ success: true, archived_item: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── RESTORE TOURNAMENT ────────────────────────────────────────────────────────
export const restoreTournament = async (req, res, next) => {
  try {
    await pool.query(`SELECT fn_restore_tournament($1, $2)`, [req.params.id, req.user.id]);
    res.json({ success: true, message: `Tournament ${req.params.id} restored. Status reset to 'upcoming'.` });
  } catch (err) {
    next(err);
  }
};

// ── RESTORE TEAM ──────────────────────────────────────────────────────────────
export const restoreTeam = async (req, res, next) => {
  try {
    await pool.query(`SELECT fn_restore_team($1, $2)`, [req.params.id, req.user.id]);
    res.json({ success: true, message: `Team ${req.params.id} restored. Members must be re-invited.` });
  } catch (err) {
    next(err);
  }
};

// ── RESTORE STREAM ────────────────────────────────────────────────────────────
export const restoreStream = async (req, res, next) => {
  try {
    await pool.query(`SELECT fn_restore_stream($1, $2)`, [req.params.id, req.user.id]);
    res.json({ success: true, message: `Stream ${req.params.id} restored as 'ended'.` });
  } catch (err) {
    next(err);
  }
};

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
export const getAuditLog = async (req, res, next) => {
  try {
    const { entity_type, from_date, to_date, limit: _rawLimit = 100, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);
    const conditions = [];
    const params = [];

    if (entity_type) { params.push(entity_type); conditions.push(`aal.entity_type = $${params.length}`); }
    if (from_date)   { params.push(from_date);   conditions.push(`aal.archived_at >= $${params.length}`); }
    if (to_date)     { params.push(to_date);     conditions.push(`aal.archived_at <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Number(limit), Number(offset));

    const result = await pool.query(
      `SELECT aal.*,
              u.username  AS archived_by_user,
              ur.username AS restored_by_user
       FROM archive_audit_log aal
       LEFT JOIN users u  ON u.user_id  = aal.archived_by
       LEFT JOIN users ur ON ur.user_id = aal.restored_by
       ${where}
       ORDER BY aal.archived_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, audit_log: result.rows });
  } catch (err) {
    next(err);
  }
};

// ── PURGE OLD ARCHIVES ────────────────────────────────────────────────────────
export const purgeOldArchives = async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM fn_purge_old_archives()`);
    res.json({ success: true, purged: result.rows });
  } catch (err) {
    next(err);
  }
};