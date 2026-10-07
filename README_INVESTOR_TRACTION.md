# Investor traction page

A read-only, anonymous, always-current dashboard you can send to investors or the
IIE Cell as a link, instead of a static slide.

## How you use it
1. Admin -> Analytics -> scroll to **Investor traction page**.
2. Click **Preview what investors see** and check it first.
3. Type who it is for (e.g. "IIE Cell review"), pick an expiry (7 days to 1 year), **Create link**.
4. Copy the link now. It is shown once; only a hash is stored. Format: `https://arenax.io/investors/<token>`.
5. The table shows status, view count and last viewed per link. **Revoke** kills a link immediately.

## What investors see (aggregates only, no names, emails or per-player rows)
Users (total, MAU/WAU/DAU, stickiness, new users with growth vs previous period, 60-day chart) /
Day-7 and Day-30 return with raw counts / signup -> profile -> team -> tournament funnel /
Tournaments hosted, with teams, completed, organizers and repeat organizers, team check-in and no-show rate /
Arena Coins (earner share, redemption rate, cash cost per active user, outstanding liability in rupees, retention of coin-engaged vs other players) /
Revenue (MRR, paying subscriptions by plan) / a "how these numbers are defined" section.
Empty states are honest ("Not launched yet", "pre-revenue", "no check-in data yet"), and a banner tells viewers when the sample is small (under 100 monthly actives).

## Honesty rules built in (each covered by a test)
- Imported pro events (source `pandascore`), pending-review and cancelled tournaments are NOT counted as hosted. Admin-created tournaments are counted, so "with teams signed up" is shown beside it.
- Banned accounts are excluded from every user count, including DAU/WAU/MAU and the chart.
- Revenue excludes Pro granted through coin redemption (gateway `coins`).
- Return rate is exact-day (stricter than "any visit that week") and always shows `x of n`.
- Attendance counts only tournaments where the organizer actually ran check-in.
- No percentage is shown when there is no earlier period to compare (it says so instead).

## Fix included: admin MRR was overstated
`getBillingStats` (Admin -> Billing) counted Pro that players redeemed with coins as paying subscriptions and as MRR. It now excludes `gateway = 'coins'`, matching the investor page.

## Security
- Token: 24 random bytes (32 chars), only its SHA-256 stored. Bad / expired / revoked tokens all return the same 404.
- Public endpoint rate-limited to 30 requests/min per IP; responses are `no-store` with `X-Robots-Tag: noindex`; page has `noindex`; `/investors/` is disallowed in robots.txt.
- Snapshot cached in memory for 5 minutes (so heavy traffic cannot hammer the database).
- Admin endpoints sit behind your existing admin middleware.

## Deploy
1. Back up the DB, run `database/migrations_investor_links.sql` (safe to re-run).
2. Copy files over the repo, commit, push, restart the API, let CI rebuild `frontend/dist`.
3. **Cumulative:** `app.js`, `adminRoutes.js`, `AdminDashboard.jsx` and `adminController.js` here include all earlier zips' changes (abuse signals, tournament coins). If you deployed those, these are drop-ins. If not, deploy them first: `tractionService.js` reuses the admin coin analytics.
4. Small edits if you prefer to merge by hand: `app.js` (1 import + 1 mount), `adminRoutes.js` (1 import + 4 routes), `adminController.js` (2 `AND COALESCE(...)` conditions), `App.jsx` (1 lazy import + 1 route), `AdminDashboard.jsx` (1 import, new `InvestorLinksPanel`, 1 line to mount it), `robots.txt` (1 line).

## Verified / not verified
- Verified on MariaDB 10.11: 11 new tests (token lifecycle and hashing, expiry clamp, no personal data in output, user/DAU/WAU/MAU windows, growth, hosted-tournament rules, attendance rules, revenue rules and admin MRR parity, exact-day retention, coins null until launched, cache, 60-day trend). Breaking the imported-event, coin-revenue, banned-user or revoked-link rule each makes a test fail. Whole suite 146/146.
- Verified end to end over HTTP against the real Express app: valid token 200 with no-store and noindex headers, wrong token 404, admin endpoints 401 without login, 429 after the rate limit.
- Verified in a simulated browser: the dashboard renders for an empty database and for a rich snapshot with no NaN/undefined and correct figures; chart draws; empty states appear. `vite build` passes.
- NOT verified: a real browser and phone layout by eye, your live data and MySQL version, copy-to-clipboard in your browser, and the admin panel's click flow (create / revoke / preview) end to end. Please click through once and send a test link to yourself on a phone.
- Limit: numbers are only as good as the data. If your live database contains test accounts or admin-seeded tournaments, they are counted; clean those up (or tell me how to tell them apart) before sharing.
