-- =============================================================================
-- §8 AFFILIATE COMMERCE — additive migration
-- =============================================================================
-- Independent of everything else. Plain CREATE TABLE IF NOT EXISTS — no
-- FK-bearing ALTERs on existing tables this time, so no information_schema
-- guard needed.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section8_affiliate.sql
-- =============================================================================

-- ─── gear_items ──────────────────────────────────────────────────────────────
-- Admin-managed, same shape as §5's featured_placements: a simple list,
-- not a storefront. price_display is text, not a number — the real price
-- lives on Amazon (or whatever affiliate program) and drifts constantly;
-- ArenaX never needs to know or show the exact current price.
CREATE TABLE IF NOT EXISTS gear_items (
    item_id        INT AUTO_INCREMENT  PRIMARY KEY,
    name           VARCHAR(150)        NOT NULL,
    category       VARCHAR(50),                          -- e.g. 'mouse', 'keyboard', 'headset', 'laptop', 'monitor'
    image_url      TEXT,
    price_display  VARCHAR(50),                           -- e.g. "$59.99" — display only, not authoritative
    affiliate_url  TEXT                NOT NULL,           -- the raw Amazon Associates (or similar) link, tag included
    display_order  INT                 NOT NULL DEFAULT 0,
    is_active      BOOLEAN             NOT NULL DEFAULT TRUE,
    created_by     INT,
    created_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gear_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_gear_active_order ON gear_items(is_active, display_order);

-- ─── gear_clicks ─────────────────────────────────────────────────────────────
-- One row per redirect. user_id is nullable — the Gear section works for
-- logged-out visitors too, and a click shouldn't require an account. This
-- is ArenaX's own click log, kept independently of whatever the affiliate
-- program's own dashboard reports, so a click count here can be reconciled
-- against actual commission payouts later ("route links through a redirect
-- endpoint so clicks are tracked before commission reconciliation" — the
-- exact roadmap line this table exists for).
CREATE TABLE IF NOT EXISTS gear_clicks (
    click_id    BIGINT AUTO_INCREMENT  PRIMARY KEY,
    item_id     INT                    NOT NULL,
    user_id     INT,
    clicked_at  DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gc_item FOREIGN KEY (item_id) REFERENCES gear_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_gc_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_gc_item_date ON gear_clicks(item_id, clicked_at);
