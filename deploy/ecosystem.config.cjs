/**
 * PM2 Ecosystem Config — ArenaX Backend
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup   ← run the generated command as root to auto-start on reboot
 */
module.exports = {
  apps: [
    {
      name: "arenaX-backend",
      script: "server.js",
      cwd: "/var/www/arenaX/backend",

      // FIX H2: NODE_ENV set here in the process environment, NOT in .env
      // This ensures errorMiddleware hides stack traces in production.
      env_production: {
        NODE_ENV: "production",
        PORT:     5000,
      },
      env_development: {
        NODE_ENV: "development",
        PORT:     5000,
      },

      // Restart policy
      instances:        1,         // increase to "max" after load testing
      exec_mode:        "fork",    // use "cluster" only after adding sticky-session support
      max_memory_restart: "512M",
      restart_delay:    3000,
      max_restarts:     10,

      // Logging
      out_file:  "/var/log/arenaX/out.log",
      error_file: "/var/log/arenaX/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Watch (off in production)
      watch: false,
    },
  ],
};
