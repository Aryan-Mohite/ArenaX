import "dotenv/config";
import http from "http";
import app from "./src/app.js";
import { initSocket } from "./src/socket.js";
import pool from "./src/config/db.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown — don't leave the DB pool hanging
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await pool.end();
      console.log("DB pool closed.");
    } catch (err) {
      console.error("Error closing DB pool:", err.message);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));