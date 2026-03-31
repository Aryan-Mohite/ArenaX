import pool from "../config/db.js";

// ─── GET LIVE STREAMS ─────────────────────────────────────────────────────────
export const getLiveStreams = async (req, res, next) => {
  try {
    const { game_id, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT s.*, u.username, u.profile_picture, g.game_name, g.icon AS game_icon
      FROM streams s
      JOIN users u ON u.user_id = s.user_id
      JOIN games g ON g.game_id = s.game_id
      WHERE s.status = 'live'
    `;
    const params = [];

    if (game_id) {
      params.push(game_id);
      query += ` AND s.game_id = $${params.length}`;
    }

    params.push(Number(limit), Number(offset));
    query += ` ORDER BY s.viewer_count DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ success: true, streams: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─── GO LIVE ──────────────────────────────────────────────────────────────────
export const goLive = async (req, res, next) => {
  try {
    const { game_id, title, platform, stream_url } = req.body;
    const userId = req.user.id;

    // End any existing live stream from this user
    await pool.query(
      "UPDATE streams SET status = 'ended' WHERE user_id = $1 AND status = 'live'",
      [userId]
    );

    const result = await pool.query(
      `INSERT INTO streams (user_id, game_id, title, platform, stream_url, started_at, status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'live')
       RETURNING *`,
      [userId, game_id, title, platform || "platform", stream_url]
    );

    res.status(201).json({ success: true, stream: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── END STREAM ───────────────────────────────────────────────────────────────
export const endStream = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE streams SET status = 'ended'
       WHERE user_id = $1 AND status = 'live'
       RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No active stream found" });
    }

    res.json({ success: true, stream: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE VIEWER COUNT ──────────────────────────────────────────────────────
// Called by the frontend periodically via WebSocket (socket.io handles this),
// but also exposed as a REST fallback.
export const updateViewerCount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { viewer_count } = req.body;

    const result = await pool.query(
      `UPDATE streams SET viewer_count = $1 WHERE stream_id = $2 RETURNING *`,
      [viewer_count, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Stream not found" });
    }

    res.json({ success: true, stream: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
