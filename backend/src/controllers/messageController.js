import pool from "../config/db.js";

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res, next) => {
  try {
    const { receiver_id, content } = req.body;
    const senderId = req.user.id;

    if (senderId === Number(receiver_id)) {
      return res.status(400).json({ success: false, message: "Cannot message yourself" });
    }

    // Verify receiver exists
    const receiver = await pool.query(
      "SELECT user_id FROM users WHERE user_id = $1 AND status = 'active'",
      [receiver_id]
    );
    if (receiver.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiver_id, content]
    );

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── GET CONVERSATION ─────────────────────────────────────────────────────────
export const getConversation = async (req, res, next) => {
  try {
    const { user_id: otherId } = req.params;
    const myId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT m.*, 
              s.username AS sender_username, s.profile_picture AS sender_picture,
              r.username AS receiver_username
       FROM messages m
       JOIN users s ON s.user_id = m.sender_id
       JOIN users r ON r.user_id = m.receiver_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.sent_at DESC
       LIMIT $3 OFFSET $4`,
      [myId, otherId, Number(limit), Number(offset)]
    );

    // Mark messages sent to me as read
    await pool.query(
      `UPDATE messages SET read_status = true
       WHERE sender_id = $1 AND receiver_id = $2 AND read_status = false`,
      [otherId, myId]
    );

    res.json({ success: true, messages: result.rows.reverse() });
  } catch (err) {
    next(err);
  }
};

// ─── GET INBOX (list of conversations) ───────────────────────────────────────
export const getInbox = async (req, res, next) => {
  try {
    const myId = req.user.id;

    // Get the latest message from each unique conversation partner
    const result = await pool.query(
      `SELECT DISTINCT ON (partner_id)
              partner_id,
              partner_username,
              partner_picture,
              last_message,
              last_sent_at,
              unread_count
       FROM (
         SELECT
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
           CASE WHEN m.sender_id = $1 THEN r.username ELSE s.username END AS partner_username,
           CASE WHEN m.sender_id = $1 THEN r.profile_picture ELSE s.profile_picture END AS partner_picture,
           m.content AS last_message,
           m.sent_at AS last_sent_at,
           COUNT(m2.message_id) FILTER (
             WHERE m2.sender_id != $1 AND m2.read_status = false
           ) AS unread_count
         FROM messages m
         JOIN users s ON s.user_id = m.sender_id
         JOIN users r ON r.user_id = m.receiver_id
         LEFT JOIN messages m2 ON
           (m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
            AND m2.receiver_id = $1)
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         GROUP BY m.message_id, m.sender_id, m.receiver_id, s.username, r.username,
                  s.profile_picture, r.profile_picture
       ) conversations
       ORDER BY partner_id, last_sent_at DESC`,
      [myId]
    );

    res.json({ success: true, inbox: result.rows });
  } catch (err) {
    next(err);
  }
};
