# Tournament coins + regrouped admin coin settings

## The amounts I chose (all editable in Admin -> Coins -> Settings)
| Setting | Default | Why |
|---|---|---|
| Coins per player per completed tournament | **40** | About 8 daily logins; worth the effort of actually playing |
| Max coin-paying tournaments per player per month | **4** | Caps tournament coins at 160/month (about Rs.1.60 at 100 coins = Rs.1) |
| Min checked-in teams for a tournament to pay | **4** | Fake 2-team events pay nothing |
| Max players paid per tournament | **100** | Hard cost ceiling per event (4,000 coins = Rs.40 worst case) |
| Min account age to earn | **3 days** | Blocks brand-new throwaway accounts |
| Vest period | **3 days** | Coins start pending; reversed if the account is banned meanwhile |
| Only verified organizers / admin-run events pay | **ON** | Free-tier organizers can invent fake teams, so unverified events pay nothing |
Pro multiplier does NOT apply to tournament coins by default; add `tournament_attendance` to "Rewards the Pro multiplier applies to" to switch it on.

## When coins are paid
When a tournament becomes **completed** (organizer flips it, or the hourly status job does). Only players on teams that **checked in** (previous check-in feature) and were not no-show / disqualified. Paid once per player per tournament (safe to re-run). Also skipped: the organizer, unverified/banned accounts, a second account on a device already paid in that tournament.

## Admin panel changes (Coins -> Settings)
- Settings now grouped: Earning, Tournaments, Referrals, ArenaX Pro, Redemption limits, Budget & expiry, Anti-abuse, each with a one-line help text and an "edited" marker.
- Live summary: the most one active user can earn per month at current settings, in coins and rupees; warns if you turn the verified-organizer check off.
- New "Recent tournament payouts" table (tournament, players paid, coins, reversed, date).
- Everything saves through the existing audited settings endpoint (Recent changes list still records who changed what).
Catalog, redemption queue, disputes and user ledger tabs were already editable and are unchanged.

## Deploy
No migration needed (new settings fall back to the defaults above until you first save them).
Copy files over the repo, commit, push, restart the API, let CI rebuild `frontend/dist`.
**Cumulative:** `coinService.js`, `adminCoinController.js` and `AdminDashboard.jsx` here already include the earlier abuse-signals changes (device rule, linked accounts, risk-flag labels), so if you already deployed that zip these simply replace it. If you have NOT deployed it, deploy that zip's migration and the rest of its files too, since `tournamentCoinService.js` reads `user_signals`.
Small edits in files that may have changed in your repo: `tournamentController.js` (one import + 2 lines in `updateTournamentStatus`), `tournamentStatusJob.js` (select ids before completing, then pay), `adminRoutes.js` (one route + one import name), `RewardsTerms.jsx` (one sentence).

## Verified / not verified
- Verified on MariaDB 10.11: 13 new tests (pays once and pending; nothing before completion; no-shows/DQ/not-checked-in earn nothing; min teams; verified-organizer vs admin-run; organizer/new/banned skipped; shared device paid once; monthly cap; per-tournament cap; 0 = off and edits change the payout; vesting and ban reversal; payouts summary). Disabling the device, organizer, check-in or monthly-cap rule each makes a test fail. Whole suite 135/135.
- Verified in a simulated browser: the settings panel groups, shows help, marks edits, shows the warning when verified-organizer is off, shows the payouts table, and sends only changed settings on save; monthly-max sentence is correct (860 coins at defaults). `vite build` passes.
- NOT verified: a real browser, your live data, your MySQL version, and ADMIN_EMAILS-based "admin-run" detection against your real env (tested with a fake value).
- Limits: a farmer who creates a verified organizer account AND many real-looking accounts on separate devices can still earn; the monthly cap, 3-day account age, 3-day vest and your cash budget bound the loss. There is no winner/placement bonus because matches have no reliable results data yet.
