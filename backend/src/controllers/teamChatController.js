import pool from "../config/db.js";

// Shared helper — confirms the user is an active member of the team.
// Used by both REST handlers below and exported for the socket layer.
export const isActiveTeamMember = async (teamId, userId) => {
  const [rows] = await pool.query(
    "SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='active'",
    [teamId, userId]
  );
  return rows.length > 0;
};

// ─── GET TEAM CHAT HISTORY ─────────────────────────────────────────────────────
export const getTeamMessages = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const userId = req.user.id;
    const { limit: _rawLimit = 50, before_id } = req.query;
    const limit = Math.min(Number(_rawLimit) || 50, 100);

    const member = await isActiveTeamMember(team_id, userId);
    if (!member)
      return res.status(403).json({ success: false, message: "You are not a member of this team" });

    let query = `
      SELECT tm.*, u.username AS sender_username, u.profile_picture AS sender_picture
      FROM team_messages tm
      JOIN users u ON u.user_id = tm.sender_id
      WHERE tm.team_id = ?
    `;
    const params = [team_id];

    if (before_id) {
      params.push(before_id);
      query += " AND tm.team_message_id < ?";
    }

    query += " ORDER BY tm.team_message_id DESC LIMIT ?";
    params.push(limit);

    const [rows] = await pool.query(query, params);
    res.json({ success: true, messages: rows.reverse() });
  } catch (err) { next(err); }
};

// ─── SEND TEAM MESSAGE (REST fallback — Socket.IO is the primary path) ───────
export const sendTeamMessage = async (req, res, next) => {
  try {
    const { id: team_id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content?.trim())
      return res.status(400).json({ success: false, message: "Message cannot be empty" });

    const member = await isActiveTeamMember(team_id, userId);
    if (!member)
      return res.status(403).json({ success: false, message: "You are not a member of this team" });

    const [result] = await pool.query(
      "INSERT INTO team_messages (team_id, sender_id, content) VALUES (?,?,?)",
      [team_id, userId, content.trim()]
    );

    const [rows] = await pool.query(
      `SELECT tm.*, u.username AS sender_username, u.profile_picture AS sender_picture
       FROM team_messages tm JOIN users u ON u.user_id = tm.sender_id
       WHERE tm.team_message_id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: rows[0] });
  } catch (err) { next(err); }
};
