# §3 College / Campus module: REMOVED

This section was removed after the strategy review (Oct 2026): ArenaX users are
mainly esports enthusiasts, so there are too few students per college for campus
leaderboards or inter-college brackets to work.

## What was removed
- Routes, controllers, pages and service files for colleges, the college claim
  queue and college licensing, team-college assignment, and inter-college standings
- College filters on Team Finder, tournaments and the admin team list
- The `is_inter_college` flag on tournament creation

## What was deliberately kept
- Database tables and columns (`colleges`, `users.college_id`, `teams.college_id`,
  `tournaments.is_inter_college`) so no data is lost and the removal is reversible.
  Nothing reads or writes them any more, except the public organizer API, which
  still returns `is_inter_college` (always false for new tournaments).
- `database/migrations_section3_college.sql`, kept as history. Do not re-run it on
  a fresh database unless you are restoring the feature.

## Migration
Run `database/migrations_college_cleanup.sql` once. It marks the `college_annual`
plan inactive so it no longer appears in the plans list.

## Replacement for the growth loop
Referral codes (§7) and, later, clan / squad / city leaderboards.
