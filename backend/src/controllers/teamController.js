import pool from "../config/db.js";

// ─── GET MY TEAMS ─────────────────────────────────────────────────────────────
// FIX (info): was running 1 query per team to fetch members (N+1 problem).
// Now fetches all members for all teams in a single query and groups in JS.
export const getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [teamRows] = await pool.query(
      `SELECT t.*, g.game_name, g.icon AS game_icon, tm.role AS my_role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = ? AND tm.status = 'active'
       LEFT JOIN games g ON g.game_id = t.game_id
       ORDER BY t.created_at DESC`,
      [userId]
    );

    if (teamRows.length === 0) {
      return res.json({ success: true, teams: [] });
    }

    // FIX: single query to get ALL members across ALL user's teams at once
    const teamIds = teamRows.map((t) => t.team_id);
    const [allMembers] = await pool.query(
      `SELECT tm.team_id, tm.role, tm.joined_at,
              u.user_id, u.username, u.profile_picture, u.country
       FROM team_members tm
       JOIN users u ON u.user_id = tm.user_id
       WHERE tm.team_id IN (?) AND tm.status = 'active'
       ORDER BY CASE tm.role WHEN 'captain' THEN 0 ELSE 1 END, tm.joined_at ASC`,
      [teamIds]
    );

    // Group members by team_id in JS — O(n) instead of N queries
    const membersByTeam = {};
    for (const member of allMembers) {
      if (!membersByTeam[member.team_id]) membersByTeam[member.team_id] = [];
      membersByTeam[member.team_id].push(member);
    }

    const teams = teamRows.map((team) => ({
      ...team,
      members: membersByTeam[team.team_id] || [],
    }));

    res.json({ success: true, teams });
  } catch (err) { next(err); }
};

// ─── CREATE TEAM ──────────────────────────────────────────────────────────────
export const createTeam = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { team_name, game_id, region, description } = req.body;
    const userId = req.user.id;

    await conn.beginTransaction();

    // FIX (medium): uniqueness check is now INSIDE the transaction.
    // Previously it ran before beginTransaction(), creating a race condition
    // where two concurrent requests could both pass and insert duplicate names.
    // Inside a transaction with InnoDB, the SELECT acquires a shared read lock
    // preventing concurrent inserts of the same name.
    const [existing] = await conn.query(
      "SELECT team_id FROM teams WHERE team_name = ?",
      [team_name]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Team name already taken" });
    }

    const [result] = await conn.query(
      "INSERT INTO teams (team_name, game_id, region, description, created_by) VALUES (?,?,?,?,?)",
      [team_name, game_id || null, region, description, userId]
    );

    const teamId = result.insertId;

    // NOTE: `role` is a reserved word in MySQL 8.0 — must be backtick-quoted
    await conn.query(
      "INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?,?,'captain','active')",
      [teamId, userId]
    );

    await conn.commit();

    const [full] = await pool.query(
      "SELECT t.*, g.game_name, g.icon AS game_icon FROM teams t LEFT JOIN games g ON g.game_id = t.game_id WHERE t.team_id = ?",
      [teamId]
    );

    res.status(201).json({ success: true, team: { ...full[0], my_role: "captain", members: [] } });
  } catch (err) {
    await conn.rollback();
    // FIX: also handle DB-level duplicate key (ER_DUP_ENTRY = 1062) as a safety net
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Team name already taken" });
    }
    next(err);
  } finally {
    conn.release();
  }
};

// ─── GET TEAM ─────────────────────────────────────────────────────────────────
export const getTeam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [teamRows] = await pool.query(
      "SELECT t.*, g.game_name, g.icon AS game_icon FROM teams t LEFT JOIN games g ON g.game_id = t.game_id WHERE t.team_id = ?",
      [id]
    );
    if (teamRows.length === 0)
      return res.status(404).json({ success: false, message: "Team not found" });

    const [members] = await pool.query(
      `SELECT tm.role, tm.joined_at, u.user_id, u.username, u.profile_picture, u.country
       FROM team_members tm JOIN users u ON u.user_id = tm.user_id
       WHERE tm.team_id = ? AND tm.status = 'active'
       ORDER BY CASE tm.role WHEN 'captain' THEN 0 ELSE 1 END, tm.joined_at ASC`,
      [id]
    );

    res.json({ success: true, team: { ...teamRows[0], members } });
  } catch (err) { next(err); }
};

// ─── DELETE / DISBAND TEAM ────────────────────────────────────────────────────
export const deleteTeam = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin === true;

    if (!isAdmin) {
      const [captainCheck] = await pool.query(
        "SELECT * FROM team_members WHERE team_id=? AND user_id=? AND role='captain' AND status='active'",
        [team_id, userId]
      );
      if (captainCheck.length === 0)
        return res.status(403).json({ success: false, message: "Only the captain or an admin can disband this team" });
    }

    await pool.query("DELETE FROM teams WHERE team_id = ?", [team_id]);
    res.json({ success: true, message: isAdmin ? "Team disbanded by admin" : "Team disbanded" });
  } catch (err) { next(err); }
};

// ─── KICK MEMBER ─────────────────────────────────────────────────────────────
export const kickMember = async (req, res, next) => {
  try {
    const { id: team_id, userId: targetUserId } = req.params;
    const captainId = req.user.id;

    if (String(captainId) === String(targetUserId))
      return res.status(400).json({ success: false, message: "Cannot kick yourself" });

    const [captainCheck] = await pool.query(
      "SELECT * FROM team_members WHERE team_id=? AND user_id=? AND role='captain' AND status='active'",
      [team_id, captainId]
    );
    if (captainCheck.length === 0)
      return res.status(403).json({ success: false, message: "Only captain can remove members" });

    await pool.query("UPDATE team_members SET status='inactive' WHERE team_id=? AND user_id=?", [team_id, targetUserId]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── LEAVE TEAM ───────────────────────────────────────────────────────────────
export const leaveTeam = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const userId = req.user.id;

    const [membership] = await pool.query(
      "SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='active'",
      [team_id, userId]
    );
    if (membership.length === 0)
      return res.status(404).json({ success: false, message: "Not in this team" });
    if (membership[0].role === "captain")
      return res.status(400).json({ success: false, message: "Captain cannot leave. Disband instead." });

    await pool.query("UPDATE team_members SET status='inactive' WHERE team_id=? AND user_id=?", [team_id, userId]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── INVITE MEMBER ────────────────────────────────────────────────────────────
export const inviteMember = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const { user_id } = req.body;
    const inviterId = req.user.id;

    const [captainCheck] = await pool.query(
      "SELECT * FROM team_members WHERE team_id=? AND user_id=? AND role='captain' AND status='active'",
      [team_id, inviterId]
    );
    if (captainCheck.length === 0)
      return res.status(403).json({ success: false, message: "Only captain can invite" });

    const [alreadyMember] = await pool.query(
      "SELECT * FROM team_members WHERE team_id=? AND user_id=? AND status='active'",
      [team_id, user_id]
    );
    if (alreadyMember.length > 0)
      return res.status(409).json({ success: false, message: "Already a member" });

    const [result] = await pool.query(
      "INSERT INTO team_invitations (team_id, user_id, invited_by, status) VALUES (?,?,?,'pending')",
      [team_id, user_id, inviterId]
    );

    const [invitation] = await pool.query(
      "SELECT * FROM team_invitations WHERE invite_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, invitation: invitation[0] });
  } catch (err) { next(err); }
};

// ─── RESPOND TO INVITATION ────────────────────────────────────────────────────
export const respondToInvitation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { invite_id } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!["accept", "decline"].includes(action))
      return res.status(400).json({ success: false, message: "Invalid action" });

    const [invite] = await pool.query(
      "SELECT * FROM team_invitations WHERE invite_id=? AND user_id=? AND status='pending'",
      [invite_id, userId]
    );
    if (invite.length === 0)
      return res.status(404).json({ success: false, message: "Invitation not found" });

    await conn.beginTransaction();

    await conn.query(
      "UPDATE team_invitations SET status=? WHERE invite_id=?",
      [action === "accept" ? "accepted" : "declined", invite_id]
    );

    if (action === "accept") {
      await conn.query(
        `INSERT INTO team_members (team_id, user_id, \`role\`, status) VALUES (?,?,'member','active')
         ON DUPLICATE KEY UPDATE status='active'`,
        [invite[0].team_id, userId]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── GET ALL TEAMS (admin) ────────────────────────────────────────────────────
export const getAllTeams = async (req, res, next) => {
  try {
    const { limit = 25, offset = 0 } = req.query;

    const [rows] = await pool.query(
      `SELECT t.team_id, t.team_name, t.game_id, t.created_at,
              u.username AS captain_username
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.team_id AND tm.role = 'captain' AND tm.status = 'active'
       LEFT JOIN users u ON u.user_id = tm.user_id
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    res.json({ success: true, teams: rows });
  } catch (err) { next(err); }
};
