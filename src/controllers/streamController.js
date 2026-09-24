import pool from "../config/db.js";

// ─── GET LIVE STREAMS ─────────────────────────────────────────────────────────
export const getLiveStreams = async (req, res, next) => {
  try {
    const { game_id, limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT s.*, u.username, u.profile_picture, g.game_name, g.icon AS game_icon
      FROM streams s
      JOIN users u ON u.user_id = s.user_id
      JOIN games g ON g.game_id = s.game_id
      WHERE s.status = 'live'
    `;
    const params = [];

    if (game_id) { params.push(game_id); query += " AND s.game_id = ?"; }

    params.push(limit, Number(offset));
    query += " ORDER BY s.viewer_count DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, streams: rows });
  } catch (err) { next(err); }
};

// ─── GO LIVE ──────────────────────────────────────────────────────────────────
export const goLive = async (req, res, next) => {
  try {
    const { game_id, title, platform, stream_url } = req.body;
    const userId = req.user.id;

    // End any existing live stream from this user
    await pool.query(
      "UPDATE streams SET status = 'ended' WHERE user_id = ? AND status = 'live'",
      [userId]
    );

    const [result] = await pool.query(
      `INSERT INTO streams (user_id, game_id, title, platform, stream_url, started_at, status)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'live')`,
      [userId, game_id, title, platform || "platform", stream_url || null]
    );

    const [stream] = await pool.query(
      "SELECT * FROM streams WHERE stream_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, stream: stream[0] });
  } catch (err) { next(err); }
};

// ─── END STREAM ───────────────────────────────────────────────────────────────
export const endStream = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [active] = await pool.query(
      "SELECT stream_id FROM streams WHERE user_id = ? AND status = 'live'",
      [userId]
    );
    if (active.length === 0)
      return res.status(404).json({ success: false, message: "No active stream found" });

    await pool.query(
      "UPDATE streams SET status = 'ended' WHERE user_id = ? AND status = 'live'",
      [userId]
    );

    const [stream] = await pool.query(
      "SELECT * FROM streams WHERE stream_id = ?",
      [active[0].stream_id]
    );

    res.json({ success: true, stream: stream[0] });
  } catch (err) { next(err); }
};

// ─── UPDATE VIEWER COUNT ──────────────────────────────────────────────────────
// FIX (high): previously any authenticated user could set viewer_count for any stream.
// Now we require AND user_id = ? to enforce ownership.
export const updateViewerCount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { viewer_count } = req.body;
    const userId = req.user.id;

    const [result] = await pool.query(
      "UPDATE streams SET viewer_count = ? WHERE stream_id = ? AND user_id = ?",
      [viewer_count, id, userId]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Stream not found or not yours" });

    const [stream] = await pool.query(
      "SELECT * FROM streams WHERE stream_id = ?",
      [id]
    );

    res.json({ success: true, stream: stream[0] });
  } catch (err) { next(err); }
};
