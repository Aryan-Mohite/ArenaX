import { Server } from "socket.io";
import { verifyToken } from "./utils/jwt.js";
import pool from "./config/db.js";

let io;

export const initSocket = (httpServer) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = verifyToken(token);
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

    // Join a personal room so server can target this user directly
    socket.join(`user:${userId}`);

    // ── PRESENCE ───────────────────────────────────────────────────────────
    socket.on("go_online", () => {
      socket.broadcast.emit("user_online", { userId });
    });

    // ── DIRECT MESSAGES ────────────────────────────────────────────────────
    socket.on("send_message", async ({ receiverId, content }) => {
      if (!receiverId || !content?.trim()) return;

      try {
        const result = await pool.query(
          `INSERT INTO messages (sender_id, receiver_id, content)
           VALUES ($1, $2, $3) RETURNING *`,
          [userId, receiverId, content.trim()]
        );

        const message = result.rows[0];

        // Deliver to receiver's personal room (works across multiple sockets)
        io.to(`user:${receiverId}`).emit("new_message", {
          ...message,
          sender_username: socket.user.username,
        });

        // Echo back to sender so their own UI updates
        socket.emit("message_sent", message);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
        console.error("Socket send_message error:", err.message);
      }
    });

    // ── STREAM ROOMS ───────────────────────────────────────────────────────
    socket.on("join_stream", ({ streamId }) => {
      socket.join(`stream:${streamId}`);
      io.to(`stream:${streamId}`).emit("viewer_joined", { userId });
    });

    socket.on("leave_stream", ({ streamId }) => {
      socket.leave(`stream:${streamId}`);
      io.to(`stream:${streamId}`).emit("viewer_left", { userId });
    });

    socket.on("stream_chat", ({ streamId, message }) => {
      if (!message?.trim()) return;
      io.to(`stream:${streamId}`).emit("stream_chat_message", {
        userId,
        username: socket.user.username,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      });
    });

    // ── TOURNAMENT ROOMS ───────────────────────────────────────────────────
    socket.on("join_tournament", ({ tournamentId }) => {
      socket.join(`tournament:${tournamentId}`);
    });

    // Called by the organizer when a match result is recorded
    socket.on("match_update", ({ tournamentId, matchData }) => {
      io.to(`tournament:${tournamentId}`).emit("bracket_updated", matchData);
    });

    // ── MATCHMAKING QUEUE ──────────────────────────────────────────────────
    socket.on("join_queue", ({ gameId }) => {
      socket.join(`queue:${gameId}`);
      socket.emit("queue_joined", { gameId, message: "Searching for opponent..." });
    });

    socket.on("leave_queue", ({ gameId }) => {
      socket.leave(`queue:${gameId}`);
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user ${userId}`);
      socket.broadcast.emit("user_offline", { userId });
    });
  });

  return io;
};

// Utility to emit to a specific user from anywhere in the app
export const emitToUser = (userId, event, data) => {
  if (!io) throw new Error("Socket not initialized");
  io.to(`user:${userId}`).emit(event, data);
};

// Utility to emit to a tournament room
export const emitToTournament = (tournamentId, event, data) => {
  if (!io) throw new Error("Socket not initialized");
  io.to(`tournament:${tournamentId}`).emit(event, data);
};