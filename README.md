# §4 ArenaX Pro (Gamer Membership) — frontend patch

Files are laid out at their repo paths; drop them over the existing tree.

## New
- `frontend/src/utils/razorpay.js` — shared Razorpay script loader (was inline in OrganizerDashboard).

## Modified
- `frontend/src/components/OrganizerTiers.jsx` — `TierCard` takes an optional `contentMap` (defaults to organizer copy, so existing callers are unchanged); new `GAMER_TIER_CONTENT`; `PlansModal` moved here from OrganizerDashboard and exported.
- `frontend/src/pages/OrganizerDashboard.jsx` — now imports `PlansModal` and `loadRazorpayScript` instead of local copies. No behaviour change.
- `frontend/src/pages/Profile.jsx` — new "⭐ Go Pro / ArenaX Pro" tab (plan cards, Razorpay upgrade, downgrade); Pro badge beside the username; banner strip in the header; banner URL field in Edit Loadout (Pro only, otherwise an upsell link).
- `frontend/src/pages/UserProfile.jsx` — shows the Pro badge on public profiles (`is_verified` was already returned by the API but never rendered).
- `src/controllers/authController.js` — `getMe` now also selects `profile_banner_url` (one-line change; needed so the Profile page can show/edit its own banner).

## Setup
No migrations, env vars or packages. `npm run build` (Vite) passes.
Requires the `gamer_pro` plan row to exist in `plans` (backend already supports `GET /payments/plans?category=gamer`).

## Known limitation (existing backend design, not changed)
`activateFromPayment` keeps one active subscription per user, so buying ArenaX Pro cancels any active Organizer plan and vice versa. The Pro tab shows a short note about this. If you want gamer and organizer plans to coexist, that needs a backend change (category-scoped subscriptions, plus `getMySubscription` / `cancelSubscription` filtering by category).

## Not included
Advanced-stats view when scouting other players (`GET /users/:id/advanced-stats` is still unused by the UI) and priority-placement visuals in Team Finder.
