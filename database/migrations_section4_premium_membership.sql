-- =============================================================================
-- §4 PREMIUM GAMER MEMBERSHIP — additive migration
-- =============================================================================
-- Independent of everything else. The `gamer_pro` plan already exists
-- (inserted back in §1) with three of its four feature flags — this just
-- adds the fourth (profile_banner, for profile customization) and the
-- column it gates.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section4_premium_membership.sql
-- =============================================================================

-- §1 inserted gamer_pro with verified_badge / advanced_stats / priority_placement
-- but not profile_banner (the roadmap's "profile customization" bullet) —
-- add it now rather than re-inserting the whole plan row.
UPDATE plans
   SET feature_flags = JSON_SET(feature_flags, '$.profile_banner', true)
 WHERE plan_key = 'gamer_pro'
   AND JSON_EXTRACT(feature_flags, '$.profile_banner') IS NULL;

-- ─── users.profile_banner_url ────────────────────────────────────────────────
-- Gated field: only ArenaX Pro subscribers can set it (enforced in
-- userController.updateProfile, same silent-ignore-if-not-entitled pattern
-- §2 already uses for the free-tier max_teams cap — this isn't a hard 403,
-- it's just not applied). Nullable, so a lapsed subscriber's existing
-- banner quietly stops being editable rather than needing to be deleted.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_banner_url TEXT NULL;
