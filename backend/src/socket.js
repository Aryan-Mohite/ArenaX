import { Server } from "socket.io";
import { verifyToken } from "./utils/jwt.js";
import pool from "./config/db.js";

const SOCKET_MSG_MAX_LEN  = 2000;
const STREAM_CHAT_MAX_LEN = 500;

const socketEventCounts = new Map();
const RATE_WINDOW_MS  = 60_000;
const RATE_MAX_EVENTS = 60;

function isRateLimited(userId) {
  const now = Date.now();
  let entry = socketEventCounts.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
  }
  entry.count += 1;
  socketEventCounts.set(userId, entry);
  return entry.count > RATE_MAX_EVENTS;
}

// FIX H5: Prune stale rate-limit entries every 5 minutes to prevent memory leak
// from long-lived connections that never disconnect.
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of socketEventCounts) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) {
      socketEventCounts.delete(userId);
    }
  }
}, 5 * 60_000);

let io;

export const initSocket = (httpServer) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
    .split(",").map((o) => o.trim());

  io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

  // ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    try {
      const decoded = verifyToken(token);

      const [rows] = await pool.query(
        "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
        [decoded.id]
      );

      if (rows.length === 0) {
        return next(new Error("Account inactive or banned"));
      }

      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── CONNECTION ────────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log(`Socket connected: user ${userId}`);
    socket.join(`user:${userId}`);

    socket.on("go_online", () => socket.broadcast.emit("user_online", { userId }));

    // ── DIRECT MESSAGES ────────────────────────────────────────────────────
    socket.on("send_message", async ({ receiverId, content }) => {
      if (!receiverId || !content?.trim()) return;

      const safeReceiverId = Number(receiverId);
      if (!Number.isInteger(safeReceiverId) || safeReceiverId < 1)
        return socket.emit("error", { message: "Invalid recipient" });

      if (isRateLimited(userId))
        return socket.emit("error", { message: "Sending messages too quickly — slow down" });

      if (content.trim().length > SOCKET_MSG_MAX_LEN)
        return socket.emit("error", { message: `Message too long (max ${SOCKET_MSG_MAX_LEN} characters)` });

      try {
        const [receiverRows] = await pool.query(
          "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
          [safeReceiverId]
        );
        if (receiverRows.length === 0)
          return socket.emit("error", { message: "Recipient not found" });

        const [insertResult] = await pool.query(
          "INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
          [userId, safeReceiverId, content.trim()]
        );

        const [msgRows] = await pool.query(
          "SELECT * FROM messages WHERE message_id = ?",
          [insertResult.insertId]
        );
        const message = msgRows[0];

        io.to(`user:${safeReceiverId}`).emit("new_message", {
          ...message,
          sender_username: socket.user.username,
        });
        socket.emit("message_sent", message);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
        console.error("Socket send_message error:", err.message);
      }
    });

    // ── STREAM ROOMS ───────────────────────────────────────────────────────
    socket.on("join_stream",  ({ streamId }) => {
      socket.join(`stream:${streamId}`);
      io.to(`stream:${streamId}`).emit("viewer_joined", { userId });
    });

    socket.on("leave_stream", ({ streamId }) => {
      socket.leave(`stream:${streamId}`);
      io.to(`stream:${streamId}`).emit("viewer_left", { userId });
    });

    socket.on("stream_chat", ({ streamId, message }) => {
      if (!message?.trim()) return;
      if (isRateLimited(userId))
        return socket.emit("error", { message: "Chatting too quickly — slow down" });
      if (message.trim().length > STREAM_CHAT_MAX_LEN)
        return socket.emit("error", { message: `Chat message too long (max ${STREAM_CHAT_MAX_LEN} characters)` });

      io.to(`stream:${streamId}`).emit("stream_chat_message", {
        userId,
        username:  socket.user.username,
        message:   message.trim(),
        timestamp: new Date().toISOString(),
      });
    });

    // ── TEAM GROUP CHAT ────────────────────────────────────────────────────
    // Only active team_members may join/post. Membership is re-checked on every
    // join and every message so kicked/left members lose access immediately —
    // even if they kept an old tab open with the room already joined.
    socket.on("join_team_chat", async ({ teamId }) => {
      const safeTeamId = Number(teamId);
      if (!Number.isInteger(safeTeamId) || safeTeamId < 1) return;
      try {
        const [rows] = await pool.query(
          "SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND status='active'",
          [safeTeamId, userId]
        );
        if (rows.length === 0)
          return socket.emit("error", { message: "You are not a member of this team" });

        socket.join(`team:${safeTeamId}`);
      } catch (err) {
        console.error("Socket join_team_chat error:", err.message);
      }
    });

    socket.on("leave_team_chat", ({ teamId }) => {
      const safeTeamId = Number(teamId);
      if (!Number.isInteger(safeTeamId) || safeTeamId < 1) return;
      socket.leave(`team:${safeTeamId}`);
    });

    socket.on("team_chat_message", async ({ teamId, content }) => {
      const safeTeamId = Number(teamId);
      if (!Number.isInteger(safeTeamId) || safeTeamId < 1 || !content?.trim()) return;

      if (isRateLimited(userId))
        return socket.emit("error", { message: "Sending messages too quickly — slow down" });

      if (content.trim().length > SOCKET_MSG_MAX_LEN)
        return socket.emit("error", { message: `Message too long (max ${SOCKET_MSG_MAX_LEN} characters)` });

      try {
        // Re-check membership on every send — not just at join time — so a
        // member kicked mid-session can't keep posting in a stale room.
        const [memberRows] = await pool.query(
          "SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND status='active'",
          [safeTeamId, userId]
        );
        if (memberRows.length === 0)
          return socket.emit("error", { message: "You are no longer a member of this team" });

        const [insertResult] = await pool.query(
          "INSERT INTO team_messages (team_id, sender_id, content) VALUES (?, ?, ?)",
          [safeTeamId, userId, content.trim()]
        );

        const [msgRows] = await pool.query(
          `SELECT tm.*, u.username AS sender_username, u.profile_picture AS sender_picture
           FROM team_messages tm JOIN users u ON u.user_id = tm.sender_id
           WHERE tm.team_message_id = ?`,
          [insertResult.insertId]
        );

        // Broadcast to everyone in the room, including the sender — keeps a
        // single source of truth for ordering instead of an optimistic-bubble
        // diverging from the server copy.
        io.to(`team:${safeTeamId}`).emit("team_chat_message", msgRows[0]);
      } catch (err) {
        socket.emit("error", { message: "Failed to send team message" });
        console.error("Socket team_chat_message error:", err.message);
      }
    });

    // ── TOURNAMENT ROOMS ───────────────────────────────────────────────────
    socket.on("join_tournament", ({ tournamentId }) => socket.join(`tournament:${tournamentId}`));

    socket.on("match_update", async ({ tournamentId, matchData }) => {
      try {
        const [rows] = await pool.query(
          "SELECT email FROM users WHERE user_id = ?",
          [socket.user.id]
        );
        if (rows.length === 0) return;

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

        if (!adminEmails.includes(rows[0].email.toLowerCase())) {
          return socket.emit("error", { message: "Admin access required to update bracket" });
        }

        io.to(`tournament:${tournamentId}`).emit("bracket_updated", matchData);
      } catch (err) {
        console.error("Socket match_update error:", err.message);
      }
    });

    // ── MATCHMAKING ────────────────────────────────────────────────────────
    socket.on("join_queue",  ({ gameId }) => {
      socket.join(`queue:${gameId}`);
      socket.emit("queue_joined", { gameId, message: "Searching for opponent..." });
    });
    socket.on("leave_queue", ({ gameId }) => socket.leave(`queue:${gameId}`));

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user ${userId}`);
      socketEventCounts.delete(userId);
      socket.broadcast.emit("user_offline", { userId });
    });
  });

  return io;
};

export const emitToUser       = (userId, event, data) => { if (!io) throw new Error("Socket not initialized"); io.to(`user:${userId}`).emit(event, data); };
export const emitToTournament = (tournamentId, event, data) => { if (!io) throw new Error("Socket not initialized"); io.to(`tournament:${tournamentId}`).emit(event, data); };
