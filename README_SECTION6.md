# §6 Analytics & Events Layer — delivery notes

Based directly on the current repo (confirmed §3/§7 are already merged in —
no rebasing needed this time, unlike the §7 delivery).

## New files

- `database/migrations_section6_analytics.sql` — run this first.
- `src/services/eventService.js` — `logEvent()` + the `EVENT_TYPES` constants.
- `src/jobs/analyticsRollupJob.js` — nightly cron, mirrors `tournamentStatusJob.js`.

## Modified files

- `server.js` — registers the nightly rollup cron (`startAnalyticsRollupJob()`).
- `src/controllers/adminController.js` — five analytics endpoints (appended).
- `src/routes/adminRoutes.js` — routes for the above (appended).
- `src/controllers/authController.js` — logs `signup` (in `verifyRegisterOtp`)
  and `login`.
- `src/controllers/tournamentController.js` — logs `tournament_registration`
  (in `registerForTournament`).
- `src/controllers/teamController.js` — logs `team_created` (in `createTeam`).
- `src/controllers/communityController.js` — logs `community_post` (in
  `createPost`).

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section6_analytics.sql
```

No new env vars. No new npm packages — `node-cron` is already a dependency
(used by `tournamentStatusJob.js`).

**One thing to actually do, not just deploy**: the rollup job only fills in
`analytics_daily_rollup` going forward, and the retention/funnel queries
only see activity from the moment this migration runs — there's no way to
backfill "logins" for days before the `events` table existed. This is the
exact "start logging immediately, you can't backfill history later" point
the roadmap makes for this section, so the sooner this ships, the less
history you lose.

## Design decisions worth knowing about

- **Every event log call is fire-and-forget** (`logEvent(...)`, never
  `await`ed), and `logEvent` itself swallows its own errors. Same shape as
  the existing `awardNexusPostAchievement(userId).catch(...)` call in
  `communityController.js` — a logging failure must never be able to break
  the request it's attached to.
- **Two different mechanisms for two different jobs, matching what's
  already in this codebase**: chat pruning uses a probabilistic
  fire-and-forget check on read (10% chance per message fetch) because it's
  cheap, frequent, and doesn't need to run on a fixed schedule. The nightly
  rollup uses real `node-cron` instead, mirroring `tournamentStatusJob.js`
  and `pandaScoreSyncJob.js` — it genuinely needs to run once, at a
  specific time, regardless of whether anyone happens to hit an endpoint
  right then.
- **DAU/WAU/MAU and retention query `events` directly; the trend chart
  reads the rollup table instead.** These aren't the same kind of query —
  DAU/WAU/MAU need a `COUNT(DISTINCT user_id)` over a live window, which
  can't be derived by summing precomputed daily numbers without
  double-counting repeat visitors. The rollup table exists only for the
  "activity per day over the last N days" trend line, where re-scanning
  the full `events` table on every dashboard load would get expensive as it
  grows.
- **"Profile complete" isn't a stored event.** It's a state that can flip
  back and forth (someone can clear their bio), not a one-time action, so
  the funnel endpoint reads it live off `users.bio`/`users.profile_picture`
  — the same read `referralService.checkActivation` already does for §7.
  No new instrumentation needed in `updateProfile`.
- **Retention definition**: classic D7/D30 — of the users who signed up on
  a given day, what fraction logged in again on exactly day+7 (or day+30)
  after signup. Bounded lookback (8 cohorts for D7, 6 for D30) so the query
  stays cheap as `users` grows, rather than scanning every cohort ever.
- **Organizer retention definition**: an "organizer" is anyone who's
  created at least one tournament; "retained" means they created
  tournaments in more than one distinct calendar month. This is a
  judgment call — the roadmap doesn't specify an exact definition, and a
  proper month-over-month cohort table would be overkill at current
  volume. Worth revisiting once there's enough organizer history for that
  to matter.
- **`metadata` on each event row** (e.g. `{ tournament_id, team_id }` on a
  `tournament_registration`) is there for later drill-down queries (e.g.
  "which tournaments actually drive registrations") without needing a
  schema change to add it — matches the `feature_flags` JSON-column pattern
  already used in `plans`.

## Endpoints added

```
GET /api/admin/analytics/overview             — { dau, wau, mau, totalUsers }
GET /api/admin/analytics/retention?window=7|30 — D7/D30 cohorts
GET /api/admin/analytics/funnel                — signups → profileComplete → firstTournament
GET /api/admin/analytics/organizer-retention   — { totalOrganizers, returningOrganizers, retentionRate }
GET /api/admin/analytics/trend?days=30         — daily rollup, chart-ready
```

All five are admin-only (mounted under the same `requireAdmin` gate as
every other route in `adminRoutes.js`).

## Not built (intentionally, per the roadmap's own scope)

- No internal dashboard *UI* — this is the API layer the roadmap calls "the
  dashboard is what you actually show the IIE Cell and investors." Wiring
  these five endpoints into an actual admin-panel screen (charts, cohort
  tables) is frontend work on top of this.
- No event types beyond the roadmap's exact five (signups, logins,
  tournament registrations, team formations, community posts). Adding more
  later (e.g. `swipe_match`, `dailies_completed`) is just adding a constant
  to `EVENT_TYPES` and one `logEvent(...)` call at the relevant point — the
  table and job don't need to change.
- No data-retention/pruning policy on `events` itself. It's append-only and
  will grow indefinitely; if that ever becomes a storage concern, archiving
  old rows into a cold table (same shape as the existing
  `archive_tournaments`-style tables) is the natural next step — not done
  here since there's no volume problem yet.
