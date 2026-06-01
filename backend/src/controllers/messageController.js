import pool from "../config/db.js";

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res, next) => {
  try {
    const { receiver_id, content } = req.body;
    const senderId = req.user.id;

    if (senderId === Number(receiver_id))
      return res.status(400).json({ success: false, message: "Cannot message yourself" });

    const [receiver] = await pool.query(
      "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
      [receiver_id]
    );
    if (receiver.length === 0)
      return res.status(404).json({ success: false, message: "Recipient not found" });

    const [result] = await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
      [senderId, receiver_id, content]
    );

    // Fetch the inserted row (RETURNING not available in MySQL)
    const [msg] = await pool.query(
      "SELECT * FROM messages WHERE message_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, message: msg[0] });
  } catch (err) { next(err); }
};

// ─── GET CONVERSATION ─────────────────────────────────────────────────────────
export const getConversation = async (req, res, next) => {
  try {
    const { user_id: otherId } = req.params;
    const myId = req.user.id;
    const { limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    const [rows] = await pool.query(
      `SELECT m.*,
              s.username AS sender_username, s.profile_picture AS sender_picture,
              r.username AS receiver_username
       FROM messages m
       JOIN users s ON s.user_id = m.sender_id
       JOIN users r ON r.user_id = m.receiver_id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.sent_at DESC
       LIMIT ? OFFSET ?`,
      [myId, otherId, otherId, myId, limit, Number(offset)]
    );

    // Mark messages sent to me as read
    await pool.query(
      "UPDATE messages SET read_status = 1 WHERE sender_id = ? AND receiver_id = ? AND read_status = 0",
      [otherId, myId]
    );

    res.json({ success: true, messages: rows.reverse() });
  } catch (err) { next(err); }
};

// ─── GET INBOX (list of conversations) ───────────────────────────────────────
// Fixed: removed the broken LEFT JOIN + GROUP BY unread_count approach.
// The original query grouped by m.message_id which made the SUM aggregate
// per-message (always 0 or 1) instead of per-conversation.
// Replaced with a correlated subquery that counts unread messages correctly
// for each conversation partner after ROW_NUMBER() picks the latest message.
export const getInbox = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const [rows] = await pool.query(
      `SELECT partner_id,
              partner_username,
              partner_picture,
              last_message,
              last_sent_at,
              -- Fixed: correlated subquery gives the true per-conversation unread count
              (
                SELECT COUNT(*)
                FROM messages m3
                WHERE m3.sender_id   = conversations.partner_id
                  AND m3.receiver_id = ?
                  AND m3.read_status = 0
              ) AS unread_count
       FROM (
         SELECT
           CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id,
           CASE WHEN m.sender_id = ? THEN r.username    ELSE s.username  END AS partner_username,
           CASE WHEN m.sender_id = ? THEN r.profile_picture ELSE s.profile_picture END AS partner_picture,
           m.content AS last_message,
           m.sent_at AS last_sent_at,
           ROW_NUMBER() OVER (
             PARTITION BY CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
             ORDER BY m.sent_at DESC
           ) AS rn
         FROM messages m
         JOIN users s ON s.user_id = m.sender_id
         JOIN users r ON r.user_id = m.receiver_id
         WHERE m.sender_id = ? OR m.receiver_id = ?
       ) conversations
       WHERE rn = 1
       ORDER BY last_sent_at DESC`,
      // 1 for correlated subquery receiver check, 5 for CASE/PARTITION, 2 for WHERE
      [myId, myId, myId, myId, myId, myId, myId]
    );

    res.json({ success: true, inbox: rows });
  } catch (err) { next(err); }
};
