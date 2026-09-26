-- =============================================================================
-- §2b ORGANIZER TIER CONSOLIDATION — 3 tiers → 2 (Free, Pro)
-- =============================================================================
-- Run after migrations_section2_organizer_tiers.sql.
--
-- The Organization tier (`organizer_org`) doesn't have anywhere to plug in
-- yet — it was meant for §3's college/org billing, which isn't built. Until
-- then it was just adding a confusing third paid-looking option next to
-- Free/Pro. This folds its two extra flags into Pro and retires the plan
-- row (deactivated, not deleted, so historical subscriptions/payments still
-- resolve correctly).
--
-- No other code references the `organizer_org` plan_key directly — every
-- gate in the codebase checks a feature_flags key via hasFeature(), so
-- folding the flags into `organizer_pro` is enough to preserve behavior for
-- anyone who Pro already unlocked.
-- All statements are safe to re-run.
-- =============================================================================

UPDATE plans
   SET feature_flags = JSON_MERGE_PATCH(
         feature_flags,
         JSON_OBJECT('multi_tournament_dashboard', true, 'api_access', true)
       )
 WHERE plan_key = 'organizer_pro';

-- Deactivated rather than deleted: any existing `organizer_org` subscription
-- keeps its FK intact and getPlans()/getMySubscription() simply stop
-- surfacing it as a selectable option (is_active = FALSE is already the
-- filter both use).
UPDATE plans
   SET is_active = FALSE
 WHERE plan_key = 'organizer_org';

-- If anyone is still on an active organizer_org subscription, move them to
-- Pro so they keep everything they had (now folded into Pro above) instead
-- of being left on a retired, invisible plan.
UPDATE subscriptions s
  JOIN plans old_p ON old_p.plan_id = s.plan_id AND old_p.plan_key = 'organizer_org'
  JOIN plans new_p ON new_p.plan_key = 'organizer_pro'
   SET s.plan_id = new_p.plan_id
 WHERE s.status = 'active';
