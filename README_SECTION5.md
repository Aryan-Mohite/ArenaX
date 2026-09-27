# §5 Sponsorship + merge-drift fixup — delivery notes

Based directly on your uploaded repo state.

## Read this part first: a merge-drift bug was found and fixed

§6 and §9 were built independently (each based on the repo state at the
time) and both touched `src/controllers/adminController.js` and
`src/controllers/tournamentController.js`. When both zips got applied,
whichever was applied second silently overwrote the other's changes to
those two shared files. Specifically, **these were missing from your
uploaded repo**:

- `adminController.js` / `adminRoutes.js`: all 5 of §6's analytics
  endpoints (`getAnalyticsOverview`, `getRetentionCohorts`, `getFunnel`,
  `getOrganizerRetention`, `getAnalyticsTrend`) and their routes under
  `/api/admin/analytics/*`.
- `tournamentController.js`: the `tournament_registration` event log call
  in `registerForTournament` (the `eventService` import and `logEvent(...)`
  line).

Both are restored in this delivery, verified against your actual uploaded
files — everything else (§0/§1/§2/§2b/§3/§6's other 4 event log points/§7/§9)
was checked and is intact, nothing else was lost.

**Going forward**: when two deliveries touch the same file independently,
applying them in the wrong order (or applying the second as a blind
overwrite) can silently drop the first one's changes to that file. Worth
diffing shared files after merging two deliveries, or asking me to check,
if this happens again.

## New files (§5)

- `database/migrations_section5_sponsorship.sql` — run this first.
- `src/controllers/sponsorController.js`
- `src/routes/sponsorRoutes.js`

## Modified files

- `src/app.js` — mounts `sponsorRoutes` at `/api/sponsors`.
- `src/controllers/adminController.js` — §6 fixup (restored) + §5's sponsor
  application queue, placement management, and sponsor-insights endpoints
  (appended).
- `src/routes/adminRoutes.js` — §6 fixup (restored) + routes for the above.
- `src/controllers/tournamentController.js` — §6 fixup (restored event log)
  + `getFeaturedTournaments` (appended).
- `src/routes/tournamentRoutes.js` — `GET /featured`.

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section5_sponsorship.sql
```

Safe to re-run — same `information_schema` guard as §3/§7/§9's FK-bearing
ALTERs. No new env vars, no new npm packages.

## Design decisions worth knowing about

- **`users.account_type` is the one new *stored* role.** "Organizer" and
  "admin" stay exactly as implicit as they already were elsewhere in this
  codebase (an organizer is just any user who's created a tournament; admin
  comes from `ADMIN_EMAILS` at login, never stored) — this doesn't refactor
  that. `account_type` only exists because sponsor status needs to persist
  independently of any specific action, the same way college membership
  does.
- **Sponsor application mirrors the college-claim / organizer-verification
  pattern exactly**: `POST /api/sponsors/apply` → `pending` →
  `POST /api/admin/sponsors/:id/approve` flips both `sponsor_profiles.status`
  and `users.account_type` in one transaction.
- **Featured placements are manual-only, no bidding marketplace** — exactly
  what the roadmap says is enough for now. An admin picks a tournament +
  an approved sponsor + an optional date range via
  `POST /api/admin/placements`; `getFeaturedTournaments` (public) only
  shows placements that are active *and* whose sponsor is still approved
  (so a later-rejected sponsor's placements disappear automatically,
  without needing manual cleanup).
- **`getSponsorInsights` is the actual product-in-waiting** the roadmap
  describes: aggregate, anonymized tournament-participation counts (this
  quarter vs. last, and the college-player share of it), built entirely on
  §6's `events` table with an optional `game_id` filter — genuinely able to
  answer "Valorant tournament participation among college players rose X%
  this quarter." It's admin-only for now since there's no sponsor-facing
  portal yet — the roadmap frames the actual sponsor product as coming
  later, once real sponsor demand exists.
- **Quarter-over-quarter comparison, not month-over-month** — matches the
  roadmap's own example question exactly ("rose X% this quarter"). If
  finer granularity turns out to be more useful once there's a real sponsor
  looking at this, that's a small change to the two date-range queries in
  `getSponsorInsights`, not a schema change.

## Endpoints added

```
POST /api/sponsors/apply  { company_name, website?, contact_email?, logo_url? }  (auth)
GET  /api/sponsors/me                                                             (auth)

GET  /api/tournaments/featured                                                    (public)

GET   /api/admin/sponsors?status=pending                        (admin)
POST  /api/admin/sponsors/:id/approve                            (admin)
POST  /api/admin/sponsors/:id/reject                             (admin)
GET   /api/admin/placements                                      (admin)
POST  /api/admin/placements  { tournament_id, sponsor_id, slot_type?, starts_at?, ends_at? }  (admin)
PATCH /api/admin/placements/:id  { is_active }                   (admin)
GET   /api/admin/sponsor-insights?game_id=                       (admin)

GET /api/admin/analytics/overview             (restored)
GET /api/admin/analytics/retention?window=7|30 (restored)
GET /api/admin/analytics/funnel                (restored)
GET /api/admin/analytics/organizer-retention   (restored)
GET /api/admin/analytics/trend?days=30         (restored)
```

## Not built (intentionally, per the roadmap's own scope)

- No bidding marketplace UI — explicitly out of scope per the roadmap.
- No sponsor-facing portal for `getSponsorInsights` — admin-only until
  real sponsor demand exists, per the roadmap's own framing.
- No payment/billing tied to sponsorship — the roadmap doesn't ask for
  this yet either; placements are admin-assigned, not self-serve/paid.
- Frontend is untouched — the sponsor application form, the admin
  sponsor/placement queues, and the homepage featured-tournament banner
  are frontend work on top of this.
