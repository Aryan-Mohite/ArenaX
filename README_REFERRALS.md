# Referral / ambassador dashboard: pays Arena Coins, with abuse protection

Run once: `database/migrations_referral_coins.sql` (safe to re-run). Then copy files over the repo, commit, push, restart the API, let CI rebuild frontend/dist.

## What I found
The dashboard (Invite & Earn page, share widget, invited/activated/pending, progress per invite) was already built and linked from the navbar, so the old audit doc is stale. The real gaps:
1. **The reward was XP, and nothing in the product spends XP.** Referrers were paid in a number they could never use.
2. Crediting only ran when the referrer opened the dashboard.
3. Nothing protected a reward that can now become a gift card (no cap, no hold, no ban handling).
4. No admin view of the referral loop.

## Changes
Backend
- Activated referrals now pay **Arena Coins** through the coin ledger (reason `referral`, key `referral:<friendId>`, so a friend can never be paid twice, even under concurrent runs). Old XP rows and users.xp_balance are left alone.
- Admin-editable settings (Admin -> Coins -> Settings, appear automatically): `earn_referral` (default 200 coins), `referral_hold_days` (7), `referral_monthly_cap` (10). Set earn_referral to 0 to pause the program.
- Protection, same spirit as team-join coins: banned referrer earns nothing; friend must be a normal account; monthly cap per referrer (overflow stays pending and pays next month); coins are held `pending` and only vest if the friend is still a normal account, otherwise they are reversed.
- Crediting now also runs on login and when the Rewards page loads (fire-and-forget), not only on the dashboard.
- GET /api/referrals/mine returns coin earned / on hold, per-invite coin state, and the live program rules. New admin endpoint GET /api/admin/analytics/referrals.

Frontend
- Invite & Earn page: coins earned and on hold, per-invite state (on hold until <date> / earned / reversed / still onboarding with the steps left), "How it works" with LIVE numbers (never hard-coded), monthly-limit notice, paused notice, and a WhatsApp share button next to Share.
- Rewards "Ways to earn" row for referrals links to the dashboard.
- Admin -> Analytics: new Referrals section (invited, activated + rate, share of signups via referral, coins paid / on hold / reversed, top referrers table).

## Decisions I made (all editable or easy to flip)
- Reward 200 coins (about Rs.2 at the default rate), held 7 days, max 10 per month. At the cap that is up to Rs.20 per referrer per month. Change in admin settings.
- Only the referrer is paid. A welcome bonus for the invited friend would help conversion but doubles the farming surface; I left it out.
- "Activated" is unchanged (profile photo+bio, a game added, and a team tournament entry or a Nexus post).

## Known limits
- Cap + hold + ban reversal make farming unprofitable at small scale, but a determined person with many real-looking accounts is only fully stopped by the phone verification you planned for later.
- No IP/device checks; the admin Referrals table is the manual review tool.

## Verified
- 67/67 tests pass against MariaDB 10.11 (54 earlier + 13 new in tests/referrals.test.js).
- Mutation-checked: removing the banned-referrer check, the monthly cap, the banned-friend check, the hold, the vesting rule, or the unique payout key each fails a test.
- The real endpoint output (friends on hold / vested / reversed / still onboarding) was rendered by the actual Referrals page and the admin section in jsdom: correct states, live rules, cap / paused / empty / failed-request cases, no runtime errors.
- Not checked in a real browser or on live data.

## Files
database/migrations_referral_coins.sql,
src/services/referralService.js, src/services/coinService.js, src/services/achievementService.js,
src/controllers/referralController.js, src/controllers/coinController.js, src/routes/adminRoutes.js,
frontend/src/pages/Referrals.jsx, frontend/src/pages/Rewards.jsx, frontend/src/pages/admin/AdminDashboard.jsx,
tests/referrals.test.js, tests/helpers.js

## Cumulative note
coinService.js, Rewards.jsx, AdminDashboard.jsx and adminRoutes.js also contain earlier work (Pro-purchase guard, ledger, analytics, terms link), so they supersede the copies in earlier zips.
