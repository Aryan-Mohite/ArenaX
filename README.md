# §2 Tournament Organizer SaaS — delivery

Builds tiers on top of your existing tournament creation/registration flow,
using §1's `plans`/`subscriptions`/`hasFeature` as the enforcement layer —
no new "plan field on organizer accounts" needed, since a plan is already
just whatever `hasFeature(user_id, ...)` resolves to.

## What's new

- `database/migrations_section2_organizer_tiers.sql`:
  - `tournaments` gets `banner_url`, `brand_primary_color`, `brand_accent_color`.
  - New `organizer_verifications` table — the manual admin-approval queue.
  - Backfills `unlimited_participants: true` onto the `organizer_pro` /
    `organizer_org` plans seeded in §1 (they didn't have it yet).
- **Free-tier participant cap** — `FREE_TIER_MAX_TEAMS = 16` in
  `tournamentController.js`. Enforced server-side in `createTournament`
  regardless of what the client sends (previously, omitting `max_teams`
  meant unlimited — now it means "capped at 16" unless the organizer has
  `unlimited_participants`).
- **Organizer verification gate** — a Pro/Org-tier organizer
  (`branded_page` access) who hasn't been approved yet gets their
  tournament created as `status = 'pending_review'` instead of `'upcoming'`.
  `GET /api/tournaments` excludes `pending_review` by default (and now
  requires admin to request it explicitly — closed a minor info-leak while
  I was in there). Also closed a real gap: `PATCH /:id/status` previously
  let an organizer move their *own* tournament off any status — including
  `pending_review` — since it only checked ownership, not current status.
  Now only an admin can move a tournament off `pending_review`.
  - `src/controllers/organizerController.js` + `src/routes/organizerRoutes.js`
    (`/api/organizers/*`): request verification (`POST /verification-request`,
    requires `email_verified` first) and check status (`GET /verification-status`).
  - Admin queue in `adminController.js`/`adminRoutes.js`
    (`/api/admin/organizer-verifications*`): list pending, approve, reject.
- **Branded tournament page** (Pro/Org) — `PATCH /api/tournaments/:id/branding`,
  gated by `requireFeature("branded_page")` + ownership.
- **Organizer analytics** (Pro/Org) — `GET /api/tournaments/:id/analytics`:
  registrations over time, conversion rate, no-show rate. **Note the
  schema-level assumption**: there's no dedicated no-show status on
  registrations, so `disqualified` is used as the closest proxy, and
  "conversion" is `confirmed / total registrations`. Worth a real
  `no_show` status if this metric gets used a lot.
- **Automated announcements** (Pro/Org) — `POST /api/tournaments/:id/announce`:
  writes a row to the existing (previously unused — nothing wrote to it
  anywhere in the codebase) `notifications` table for every member of every
  registered team. This is genuinely new plumbing, not a rewire of
  something existing — flagging that since the roadmap phrased it as
  "hook into existing... infra."
- **Multi-tournament dashboard** (Organization tier) —
  `GET /api/tournaments/mine` (all your tournaments, any status, not
  gated — basic functionality) and `GET /api/tournaments/mine/summary`
  (aggregate counts across all of them, gated by
  `requireFeature("multi_tournament_dashboard")`).
- **Upgrade/downgrade** — `GET /api/payments/subscription` (current plan)
  and `POST /api/payments/cancel` (downgrade to free). **Simplification**:
  cancel is immediate (access revoked right away), not "cancel at period
  end" — flagging as the simpler of two reasonable designs, revisit if you
  want prorated/grace-period behavior.

## What's modified

- `src/app.js` — mounted `organizerRoutes` at `/api/organizers`.
- `src/routes/tournamentRoutes.js` — new routes above; `/mine` and
  `/mine/summary` are registered **before** `/:id` so they don't get
  swallowed by the id-param route.
- `src/routes/adminRoutes.js`, `src/routes/paymentRoutes.js` — new route
  wiring for the endpoints above.
- `src/controllers/tournamentController.js`, `paymentController.js`,
  `adminController.js` — new exports, described above.

## Deliberately not built this round (flagging, not hiding)

- **Org-level branding as a separate entity** — the roadmap's "org
  branding" implies an organizations concept above individual users; that
  doesn't exist yet (Organization tier here is just a user with the
  `organizer_org` plan). Building a real `organizations` table with
  multiple member-users is a bigger piece — tell me if you want that now
  or if per-user Org tier is good enough for the pilot.
- **Read-only API key for Org tier** — needs an API-key auth path
  alongside JWT auth, which is enough surface area I'd rather do as its
  own pass rather than bolt on here.
- **Phone verification** — no SMS provider wired up; the verification gate
  currently only checks `email_verified` (which already exists). Noted in
  a code comment in `organizerController.js`.

## Verified

- `node --check` on every new/modified backend file.
- Imported `src/app.js` end-to-end (fake DB env vars) — loads clean.
- Didn't touch the frontend this round — no UI yet for branding/analytics/
  announcements/upgrade flow. Say the word and I'll build that next, or
  keep going down the roadmap (§3 college module is next in the build order).

## To deploy

1. Run `database/migrations_section2_organizer_tiers.sql` (after §1's
   migration, if you haven't already).
2. Drop these files into your working copy at the same paths.
3. No new npm packages this round.
