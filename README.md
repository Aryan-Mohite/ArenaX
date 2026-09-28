# §7 Referral & Ambassador dashboard — frontend patch

Frontend only; no backend, migration, env or package changes. `npm run build` passes.

## New
- `services/referralService.js` — wraps GET /referrals/mine/code and /referrals/mine.
- `pages/Referrals.jsx` (/referrals, login required) — share widget (code, copy, invite link, native share), summary cards (invited / activated / pending / XP earned), and a per-invitee list. Pending invitees show a 3-step activation checklist (profile complete, game added, joined tournament or Nexus), so the ambassador knows exactly what to nudge.

## Modified
- `pages/Register.jsx` — optional "Referral code" field, prefilled from `/register?ref=CODE`. The backend already accepted `referral_code`; the form just never sent it.
- `App.jsx` — /referrals route. `Navbar.jsx` — "Invite & Earn" in the user dropdown.

## Caveats
- `App.jsx` and `Navbar.jsx` here are cumulative: they already include the §3 College routes/nav link as well as the §7 additions, so it's safe to overwrite with these two files whether or not you applied §3 (if you skipped §3, the College pages won't exist and the /colleges route will fail to build — apply §3 first).
- Rewards are XP only (per the roadmap); there is no cash-out UI.
- The backend credits XP lazily when this page loads, so numbers are current on every visit.
