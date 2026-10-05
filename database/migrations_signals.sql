-- Device / IP signals for abuse detection (safe to re-run).
-- Raw IPs are never stored: ip_hash is an HMAC (server secret) of the IP
-- (IPv6 reduced to its /64). device_id is a random browser-generated UUID.
-- Rows older than signal_retention_days (default 90) are deleted nightly.
CREATE TABLE IF NOT EXISTS user_signals (
  signal_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  kind       VARCHAR(10)  NOT NULL,            -- signup | login
  ip_hash    CHAR(64)     NULL,
  device_id  CHAR(36)     NULL,
  ua_hash    CHAR(16)     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_signals_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_signals_user    ON user_signals(user_id, created_at);
CREATE INDEX idx_signals_device  ON user_signals(device_id, user_id);
CREATE INDEX idx_signals_ip      ON user_signals(ip_hash, created_at);
