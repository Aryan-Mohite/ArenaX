# §8 Affiliate Commerce — delivery notes

The last piece of the roadmap. Kept deliberately small, per the roadmap's
own framing ("cheap add-on, do it last").

## Important: apply this after §5, not instead of it

`src/app.js`, `src/controllers/adminController.js`, and
`src/routes/adminRoutes.js` in this zip are based on **§5's delivery**, not
the raw repo — those three files have now been touched by §3, §6, §9, §5,
and §8, and basing this on anything earlier would silently drop §5's
sponsorship endpoints the same way §6's got dropped when §6 and §9 were
merged independently (see the §5 delivery's README for that incident).

**If you've already merged §5**: applying this zip's copies of those three
files is safe — they're §5's content plus §8's additions, nothing lost.
**If you haven't merged §5 yet**: applying this zip first gives you both
§5 and §8 in one go, and you can skip re-applying §5's copies of those
same three files afterward (just apply its new/other files:
`sponsorController.js`, `sponsorRoutes.js`, its migration, and its changes
to `tournamentController.js`/`tournamentRoutes.js`, which §8 doesn't touch).

Every other file in this zip is new and has no such dependency.

## New files

- `database/migrations_section8_affiliate.sql` — run this first (after §5's
  migration, if you haven't already run it).
- `src/controllers/gearController.js` — public listing + the redirect endpoint.
- `src/routes/gearRoutes.js`

## Modified files

- `src/app.js` — mounts `gearRoutes` at `/api/gear`.
- `src/controllers/adminController.js` — gear CRUD + click-stats endpoints (appended).
- `src/routes/adminRoutes.js` — routes for the above (appended).

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section8_affiliate.sql
```

Safe to re-run. No new env vars, no new npm packages.

## Design decisions worth knowing about

- **The redirect endpoint (`GET /api/gear/:id/redirect`) is public, no auth
  required** — anyone browsing the Gear section, logged in or not, needs to
  be able to click through to Amazon. This codebase doesn't have an
  optional/soft-auth middleware (its one `authMiddleware` always 401s
  without a token), so building per-user click attribution would have
  meant inventing a new auth pattern for a feature the roadmap doesn't ask
  for — the roadmap's stated purpose is aggregate click-count
  reconciliation against affiliate payouts, not per-user tracking, so
  `gear_clicks.user_id` stays `NULL` for now. The column is still there
  (nullable) if that ever becomes worth adding.
- **The click gets logged *before* the redirect, not fire-and-forget
  after.** Every other "log something on the side" pattern in this
  codebase (event logging, achievement awards) happens after the response
  is already sent, because those are side effects of an action that has
  its own real response to deliver. Here, logging the click **is** the
  entire point of routing through this endpoint instead of linking
  straight to Amazon — so it has to actually complete before the redirect
  fires, not race against it.
- **No pricing, no cart, no checkout logic** — `price_display` is a
  free-text string ("$59.99"), never treated as authoritative or used in
  any calculation. The real price lives on Amazon and drifts constantly;
  ArenaX only ever displays what an admin typed in, as a rough guide.
- **Gear items are fully admin-managed**, same shape as §5's
  `featured_placements` — no submission flow, no vendor self-service. This
  matches the roadmap's own scope for §8 exactly; it doesn't ask for
  anything more sophisticated.
- **`getGearClicks` is the reconciliation view** the roadmap's "before
  commission reconciliation" line is actually for — daily click counts per
  item, so whoever manages the Amazon Associates account can compare "we
  sent N clicks this month" against whatever Amazon's own dashboard
  reports as paid-out commission.

## Endpoints added

```
GET /api/gear?category=            (public)
GET /api/gear/:id/redirect         (public — logs a click, 302s to affiliate_url)

GET    /api/admin/gear                    (admin)
POST   /api/admin/gear   { name, category?, image_url?, price_display?, affiliate_url, display_order? }  (admin)
PATCH  /api/admin/gear/:id                (admin — any subset of the above, plus is_active)
DELETE /api/admin/gear/:id                (admin)
GET    /api/admin/gear/:id/clicks?days=30 (admin)
```

## Not built (intentionally, per the roadmap's own scope)

- No FTC affiliate-disclosure text — "as an Amazon Associate we earn from
  qualifying purchases" (or equivalent) is a real legal requirement for
  Amazon Associates specifically, but it's page copy, not an endpoint —
  frontend work, not backend.
- No multi-program support beyond a single `affiliate_url` per item — if
  gear ever needs region-specific links (different Amazon marketplaces) or
  a second affiliate program, that's a schema change; not needed for a
  first "Gear" section.
- Frontend is untouched — the Gear section/grid itself, the admin gear
  manager, and the click-stats chart are frontend work on top of this.

---

**This closes out every numbered section in the roadmap (§0 through §9).**
What's left is what the roadmap itself flagged as deliberately out of
scope for now: a full sponsorship bidding marketplace, AI
recommendation/matching beyond Squad Match, and a native mobile app — plus
the ops-level "turn on real payments for a first paying college pilot"
step, which is a business decision (flip the `college_annual` license via
`POST /api/admin/colleges/:id/license` from §3, whenever that pilot is
ready) rather than something left to build.
