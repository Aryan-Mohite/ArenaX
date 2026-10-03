-- College removal cleanup (safe to re-run).
-- The college feature was removed from the product (users are mainly esports
-- enthusiasts, so there is no per-campus density). Tables and columns
-- (colleges, users.college_id, teams.college_id, tournaments.is_inter_college)
-- are intentionally left in place so no data is lost and the removal is
-- reversible. This only hides the unused paid plan from the plans endpoint.
UPDATE plans SET is_active = FALSE WHERE plan_key = 'college_annual';
