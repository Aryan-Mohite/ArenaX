# Coin metrics on the Analytics tab

No migration. Copy files over the repo, commit, push, restart the API, let CI rebuild frontend/dist.

## What it adds
Admin -> Analytics -> new **Arena Coins** section at the bottom, with a 7 / 30 / 90 day selector:
- Cards: coins issued (+ per active user), coins spent, redemption rate, cash cost (delivered) and per active user, max cash liability, rejected requests, earners vs active users, paid Pro share among earners. Each card carries the "watch for" alarm sign from the TODO's metrics table.
- Daily issued vs spent chart (reuses the existing TrendChart, now accepts `series` / `xKey`).
- Retention: D7 / D30 for new users who earned a non-login coin in their first 3 days vs everyone else. Only users who signed up after coins launched. Labelled as correlation, not causation (login pays coins, so naive "earner vs non-earner" would be meaningless).
- Pro: share of coin earners with paid Pro, and Pro-days trial -> paid conversion (all time).
- Fetches on its own: if it fails, the rest of the Analytics tab is unaffected.

## API
GET /api/admin/analytics/coins?days=7|30|90   (admin only, same router as the other analytics endpoints)

## Definitions (also in the controller header)
- issued: coins earned in the window, excluding refunds, reversed rows and manual admin adjustments (shown separately as "manual net")
- active: distinct users with a login event in the window (same source as DAU/WAU/MAU)
- redemption rate: redeemers (non-rejected) / earners
- cash cost: INR value of FULFILLED gift card / top-up redemptions created in the window; Pro days cost no cash
- retained: logged in on exactly day 7 / 30 after signup (same rule as the Retention Cohorts table)
- max liability: all coins currently available / coins-per-INR (not windowed)

## Files
src/controllers/adminCoinController.js, src/routes/adminRoutes.js,
frontend/src/pages/admin/AdminDashboard.jsx, tests/coin-analytics.test.js, tests/helpers.js

## Cumulative note
These files also contain the earlier coin ledger / ban work, so they supersede the copies in arenax-coins-ledger.zip
(coinService.js, mailer.js, adminController.js etc. from earlier zips are unchanged and still needed).
tests/helpers.js now also clears the `events` table between tests.

## Verified / not verified
- 37/37 tests pass (32 existing + 5 new) against MariaDB 10.11; expected numbers are hand-computed from fixtures
- Mutation-checked: counting admin grants as issued, counting coin-granted Pro as paid, and counting login coins as "engaged" each make a test fail
- UI: built with vite and rendered in jsdom against the REAL endpoint output (populated, empty database, and failed request states); window selector refetches
- NOT verified: a real browser / your live data. Event timestamps and ledger rows use the DB clock (NOW()); if your host's DB timezone is not UTC, "today" in the chart follows the DB date.
