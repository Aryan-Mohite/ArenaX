# Admin per-user coin ledger + manual adjustment

No migration. Copy files over the repo, commit, push, restart the API, let CI rebuild frontend/dist.

## What it adds
Admin -> Coins -> **User ledger** tab (also reachable by clicking a @username in the Redemptions queue):
- User search (username/email), account status, verified flag, member-since, last login
- Available / pending balance, lifetime earned, spent on rewards
- Coins earned per day for the last 14 days (spot farming patterns)
- Full ledger table (50 per page, Load more), reversed rows dimmed
- Recent redemptions with status and admin notes
- **Manual adjustment**: signed whole number + mandatory reason. Writes one `admin_adjust` ledger row stamped `[admin #id] reason`. Append-only; fix mistakes with an opposite adjustment. Max 50,000 per adjustment; a deduction can't take the available balance below 0 (user row is locked, same lock redemptions use).

## API
- GET  /api/admin/coins/users/:id?limit=&offset=
- POST /api/admin/coins/users/:id/adjust  { amount, note }

## Files
src/services/coinService.js, src/controllers/adminCoinController.js, src/routes/adminRoutes.js,
frontend/src/pages/admin/AdminDashboard.jsx

## Cumulative note
coinService.js and adminCoinController.js ALSO contain the earlier ban-handling and fulfilment-email changes.
If you applied arenax-coins-hardening.zip, these files simply replace those. Still needed from that zip:
src/controllers/adminController.js (ban hook), src/utils/mailer.js, frontend/src/pages/Rewards.jsx.
NOTE: arenax-college-cleanup.zip also contains adminController.js (cleanup + the ban hook). Use that one.

## Verified / not verified
- Verified: node --check on backend files, vite build passes
- NOT verified: SQL and the UI against a real database/browser. On staging: adjust +100 and -100 for a test user, try a deduction larger than the balance (expect 409), check the ledger row note, open a user from the Redemptions queue.
