# §3 College / Campus Module — delivery notes

Full §3 in one pass, per the roadmap: colleges entity + claim flow, college-
scoped views, inter-college bracket type, public leaderboard, and a college
billing-tier stub hooked into §1.

## New files

- `database/migrations_section3_college.sql` — run this first.
- `src/controllers/collegeController.js`
- `src/routes/collegeRoutes.js`

## Modified files

- `src/app.js` — mounts `collegeRoutes` at `/api/colleges`.
- `src/controllers/adminController.js` — college claim queue + licensing (appended).
- `src/routes/adminRoutes.js` — routes for the above (appended).
- `src/controllers/teamController.js` — `createTeam` auto-assigns the
  captain's college; `getAllTeams` gained a `college_id` filter; new
  `updateTeamCollege` (captain-only override/clear).
- `src/routes/teamRoutes.js` — `PATCH /:id/college`.
- `src/controllers/teamFinderController.js` — `getPosts` gained a
  `college_id` filter (filters by the *poster's* college).
- `src/controllers/tournamentController.js` — `getTournaments` gained a
  `college_id` filter; `createTournament` accepts `is_inter_college`; new
  `getCollegeStandings`.
- `src/routes/tournamentRoutes.js` — `GET /:id/college-standings`.
- `src/utils/validators.js` — `validateClaimCollege`; `is_inter_college`
  added to `validateCreateTournament`.

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section3_college.sql
```

Safe to re-run — every statement is guarded (`ADD COLUMN IF NOT EXISTS`, or
an `information_schema` check for the two FK-bearing `ALTER TABLE`s, matching
the pattern already used for `tournaments.source`/`external_id` earlier in
the schema file).

No new env vars, no new npm packages.

## Design decisions worth knowing about

- **Claim flow mirrors §2's organizer-verification pattern exactly**: a
  college is created with `status = 'pending'` on claim, and only becomes
  visible/joinable once an admin approves it
  (`GET/POST /api/admin/colleges...`). The claimer isn't auto-verified as
  anything special afterward — they're just the first member.
- **No separate "college roster" or "college standings" tables.** A team
  optionally has `college_id`; a user optionally has `college_id`. Both the
  public leaderboard and inter-college standings are computed live by
  joining through `teams.college_id` — same "minimal surface area"
  convention as the rest of the codebase (no new state to keep in sync as
  matches get reported).
- **Inter-college bracket type is a flag, not a separate registration
  path.** `tournaments.is_inter_college = true` just means the tournament
  page should show a "College Standings" tab
  (`GET /:id/college-standings`) alongside the normal bracket. Registration,
  brackets, and match reporting are unchanged — a team without a college
  just won't show up in that tab.
- **College annual-license billing is a manual toggle, not a checkout
  flow**, per the roadmap ("you don't need to charge on day one"). It
  reuses `subscriptions.org_id`, which §1 reserved for exactly this. An
  admin grants/revokes it via `POST /api/admin/colleges/:id/license` — no
  Razorpay order involved. When a real college pilot is ready to pay, the
  existing `createOrder`/webhook flow in `paymentController.js` can be
  extended to accept an `org_id` instead of only `user_id` — flagging that
  as the one piece of follow-up work this stub leaves open.
- **College-scoped tournament filtering** (`GET /api/tournaments?college_id=`)
  shows tournaments a college's teams are registered in — it doesn't
  restrict who can *create* a tournament, and it isn't the same thing as
  `is_inter_college`.
- **Team → college is a default, not a lock.** `createTeam` auto-sets a new
  team's `college_id` from the captain's own college for convenience;
  `PATCH /api/teams/:id/college` lets the captain override or clear it
  (e.g. a cross-college squad, or a captain who joins a college after the
  team already exists).

## Endpoints added

```
POST   /api/colleges/claim                       (auth)
GET    /api/colleges                             (public, ?q=&limit=&offset=)
GET    /api/colleges/leaderboard                 (public, ?limit=)
GET    /api/colleges/:slug                       (public)
POST   /api/colleges/:id/join                    (auth)
POST   /api/colleges/leave                       (auth)

PATCH  /api/teams/:id/college                    (auth, captain only)
GET    /api/teams/all?college_id=                (admin — existing route, filter added)
GET    /api/teamfinder?college_id=               (existing route, filter added)

GET    /api/tournaments?college_id=              (existing route, filter added)
GET    /api/tournaments/:id/college-standings    (public)
POST   /api/tournaments  { ..., is_inter_college } (existing route, field added)

GET    /api/admin/colleges?status=pending        (admin)
POST   /api/admin/colleges/:id/approve           (admin)
POST   /api/admin/colleges/:id/reject            (admin)
POST   /api/admin/colleges/:id/license  { action } (admin)
```

## Not built (intentionally, per the roadmap's own scope)

- No sponsor/bidding integration — that's §5, later.
- No college-branded custom theming beyond the `logo_url`/leaderboard page —
  `custom_branding` sits in the `college_annual` plan's `feature_flags` as a
  flag for the frontend to key off, but no branding UI is wired to it yet.
  Same shape as how §2's `feature_flags` got added ahead of every gate being
  built.
- Frontend is untouched — this is the API surface §3 needs; the claim
  form, college search/join UI, leaderboard page, and college-standings tab
  are frontend work on top of this.
