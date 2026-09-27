# §9 Trust & Safety — delivery notes

Based directly on the current repo (§3/§7 confirmed merged; §6 is not — this
delivery doesn't depend on it either way).

## Why this, and why now

The roadmap says §9 is "required before any money changes hands" — but §1's
Razorpay flow already went live without it. This closes that gap: an
organizer terms-acceptance gate, a refund/dispute path for the payments
already being taken, and reporting extended to cover organizer-side abuse
(fake tournaments, no-shows), not just player-side content.

## New files

- `database/migrations_section9_trust_safety.sql` — run this first.
- `src/controllers/reportController.js`
- `src/routes/reportRoutes.js`

## Modified files

- `src/app.js` — mounts `reportRoutes` at `/api/reports`.
- `src/controllers/organizerController.js` — `CURRENT_TERMS_VERSION`
  constant, `acceptOrganizerTerms`, `getTermsStatus` (appended).
- `src/routes/organizerRoutes.js` — routes for the above.
- `src/controllers/tournamentController.js` — `createTournament` now blocks
  Pro/Org-tier organizers (`hasFeature(userId, "branded_page")`) who haven't
  accepted the current terms version.
- `src/controllers/paymentController.js` — `disputePayment` (appended).
- `src/routes/paymentRoutes.js` — `POST /:paymentId/dispute`.
- `src/controllers/adminController.js` — `getReports`, `resolveReport`,
  `getDisputes`, `resolveDispute` (appended).
- `src/routes/adminRoutes.js` — routes for the above.

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section9_trust_safety.sql
```

Safe to re-run — same `information_schema`-guard pattern as §3/§7's
FK-bearing ALTERs, extended here to also guard the new CHECK constraint on
`reports` (MySQL 8 doesn't support `ADD CONSTRAINT IF NOT EXISTS` for
either kind).

No new env vars, no new npm packages.

## Design decisions worth knowing about

- **The terms gate only applies to Pro/Org-tier organizers**, using the
  exact same `hasFeature(userId, "branded_page")` check §2's verification
  gate already uses — free-tier tournament creation is completely
  unaffected, matching the roadmap's own scoping ("before a paid or
  Pro-tier tournament can be published"). It's checked *before* the
  verification-status check in the same function, so an organizer who's
  missing both gets the terms message first (the more actionable one — the
  verification queue is a wait, terms acceptance is instant).
- **Terms acceptance is versioned, not a single timestamp column.** A
  `terms_version` string (`CURRENT_TERMS_VERSION`, currently `"v1"`) means
  if the actual terms text ever changes, bumping the constant forces
  re-acceptance from everyone, while every past acceptance (of the old
  version) stays on record rather than being silently overwritten — worth
  having given this is the one piece of this migration with real legal
  weight.
- **Reports now target a user OR a tournament, never both** — enforced by
  a DB-level CHECK constraint (`chk_rep_exactly_one_target`), not just
  application logic, so a bad write can't quietly create a malformed row.
  Existing player-report rows and any caller depending on `reported_user`
  being populated are completely unaffected.
- **`category` is a loose VARCHAR, not an enum.** Same looseness this
  codebase already uses for `status` columns elsewhere — the frontend's
  report-reason picker decides what values it sends (`fake_tournament`,
  `no_show`, `harassment`, `spam`, …) without a migration needed to add a
  new one.
- **Refund/dispute is a genuinely manual admin process** — exactly what the
  roadmap says is fine to start with. `resolveDispute` does NOT call
  Razorpay's refund API; an admin still has to actually issue the refund
  through Razorpay's own dashboard. What this does handle automatically:
  flipping the payment's own `status` to `'refunded'` (already a valid
  value in §1's schema) and canceling the subscription that payment opened,
  if it's still active — so a refunded payment can't leave a live
  subscription behind by accident.
- **The dispute path is keyed off `payments`, not off what the payment was
  for.** No entry-fee-specific code exists because no entry-fee payments
  exist yet (`tournaments.entry_fee` is currently a display-only field,
  never actually charged) — but this same mechanism will work unchanged
  the moment entry fees do go live, which is exactly the roadmap's framing
  ("if you ever introduce entry fees").
- **A user can only dispute their own payment, and only a `'success'`
  payment, and only one open dispute per payment at a time** — the three
  guards in `disputePayment` before a row gets created.

## Endpoints added

```
POST /api/organizers/accept-terms                       (auth)
GET  /api/organizers/terms-status                        (auth)

POST /api/reports/user/:userId        { reason, category? }  (auth)
POST /api/reports/tournament/:id      { reason, category? }  (auth)

POST /api/payments/:paymentId/dispute { reason }              (auth, owner only)

GET  /api/admin/reports?status=pending&type=user|tournament   (admin)
POST /api/admin/reports/:id/resolve   { status, note? }        (admin)
GET  /api/admin/disputes?status=open                           (admin)
POST /api/admin/disputes/:id/resolve  { status, note? }         (admin)

POST /api/tournaments  (existing route — now 403s for an unaccepted-terms
                         Pro/Org organizer, with { terms_version } in the body)
```

## Not built (intentionally, per the roadmap's own scope)

- No actual Organizer Terms / Tournament Agreement *text* — `CURRENT_TERMS_VERSION`
  is a version tag the frontend pairs with whatever legal copy you actually
  display; writing that copy isn't an engineering task.
- No automatic Razorpay refund API call — deliberately manual, as covered above.
- No entry-fee collection itself — out of scope for §9; this just makes
  sure the dispute path will already be there whenever that ships.
- Frontend is untouched — the terms-acceptance modal, report buttons/forms,
  and the admin reports/disputes queues are frontend work on top of this.
