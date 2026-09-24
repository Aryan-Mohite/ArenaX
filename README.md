# §2 Organizer Tiers — frontend

The UI for the backend built last round. Requires that backend delivery
(`arenax-section2-organizer-tiers.zip`) and §1's payments infra to already
be deployed — nothing here works without `/api/payments/*`,
`/api/tournaments/mine`, `/api/organizers/*`, and `/api/admin/billing` +
`/api/admin/organizer-verifications*` existing server-side.

## What's new

- **`frontend/src/pages/OrganizerDashboard.jsx`** (new route: `/organizer`,
  behind `ProtectedRoute` — any logged-in user, not gated to existing
  organizers, since anyone can become one):
  - Current plan card + **Upgrade/Change Plan** button opening a plans
    modal, wired to Razorpay checkout.js (loaded on demand, script cached
    across repeated opens) → `createOrder` → Razorpay modal → `verifyPayment`
    on success.
  - **Downgrade to Free** — calls the cancel endpoint, confirms first since
    it's immediate.
  - **Verification banner** — only shows once the plan actually grants
    `branded_page`; offers "Request Verification" and reflects
    pending/rejected/approved status.
  - **My Tournaments list** — from `/tournaments/mine` (shows
    `pending_review` status too, so organizers can see why a tournament
    isn't public yet). Per-tournament action buttons (Branding / Analytics
    / Announce) only render if the current plan's `feature_flags` actually
    grant that feature — no dead buttons that 403 on click.
  - **Multi-tournament summary** cards — only fetched/shown if
    `multi_tournament_dashboard` is on the plan, so free/pro organizers
    don't trigger an expected 403 on every page load.
  - Branding, Analytics, and Announce each open a focused modal rather than
    a separate page — this is organizer tooling used occasionally, not a
    primary nav destination.
- **Two new admin tabs** in `AdminDashboard.jsx` (kept in the same file,
  matching its existing single-file-multi-tab pattern):
  - **Billing** — the 4 stat cards from `/api/admin/billing` plus a recent
    payments table.
  - **Organizers** — the verification queue: approve/reject with an
    optional rejection note (modal, mirrors the existing ban-reason modal
    pattern in the Users tab).
- **`frontend/src/services/paymentService.js`,
  `frontend/src/services/organizerService.js`** — thin wrappers, same
  one-line-per-call pattern as every other service file.

## What's modified

- `frontend/src/App.jsx` — lazy import + `/organizer` route.
- `frontend/src/components/Navbar.jsx` — added an "Organizer Dashboard"
  link to the account dropdown (visible to every logged-in user, right
  above the existing admin-only link).

## Verified

- `npx vite build` — clean, no errors. New chunks:
  `OrganizerDashboard-*.js` (~13 kB gzipped ~4 kB), updated
  `AdminDashboard-*.js` (~26 kB gzipped ~7 kB). Both lazy-loaded, so this
  doesn't touch the initial bundle for users who never visit either page.

## Known gaps / next steps

- Branding fields (`banner_url`, colors) are saved but **not yet
  consumed anywhere** — the public Tournament page still renders the
  site-wide theme regardless of a tournament's branding. Applying them
  (banner in the hero, CSS custom properties scoped to that tournament's
  page) is the natural next piece if you want branding to actually show
  up publicly rather than just be stored.
- No dedicated "why is my tournament pending_review" empty state beyond
  the status badge + the verification banner — fine for now, could be
  more prominent later.

## To deploy

1. Make sure both §1 and §2 backend deliveries (migrations + code) are
   already live.
2. Drop these files into your working copy at the same paths.
3. `npm run build` in `frontend/`, commit `frontend/dist/` per your normal
   Hostinger auto-deploy flow.

## Next up

Per the roadmap's build order, **§3 (College/Campus module)** is next —
your cheapest acquisition channel. Want me to keep going there, or pause
here to actually test the organizer flow end-to-end first (e.g. set up a
real Razorpay test account)?
