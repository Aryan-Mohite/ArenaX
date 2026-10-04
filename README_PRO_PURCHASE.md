# Gamer Pro purchase flow: fixes and polish

No migration. Copy files over the repo, commit, push, restart the API, let CI rebuild frontend/dist.

## What I found
The purchase flow was already built (Profile -> "Go Pro" tab -> Razorpay checkout; the old audit doc is stale, and PaymentHistory already has a dispute button). Reading it against the coins work showed real bugs:
1. **Pro could never be renewed.** Nothing marks expired subscriptions as expired and getMySubscription ignored renews_at, so after 30 days the page still said "ArenaX Pro member" and the button stayed on "Current Plan". (Same for organizer plans.)
2. **Coin Pro days were destroyed** by any purchase (activation cancelled every active subscription) and by "Downgrade to Free". Coin-Pro users also could not upgrade at all (their plan counted as "current").
3. **verifyPayment was replayable**: only the webhook checked "already paid". Harmless before; it would have let a replayed callback stack free days once carry-over existed.
4. The coin multiplier was not mentioned anywhere on the Pro tab.

## Changes
Backend (src/controllers/paymentController.js, src/services/coinService.js)
- activateFromPayment is idempotent (row-locked check on payment status).
- Buying ArenaX Pro keeps remaining coin-Pro days (added to the paid period); an early renewal keeps remaining paid days. Buying a different plan (organizer) leaves coin Pro running. Different paid plans still replace each other, as the UI already warned.
- "Downgrade" cancels paid plans only; coin Pro days run until they end.
- getMySubscription returns only in-date subscriptions, prefers paid over coin, and adds `coin_pro_until` and `expired` (what just lapsed).
- Redeeming Pro days with coins is refused while a paid ArenaX Pro is active (they would just overlap and be wasted); nothing is charged. Message: "...Redeem Pro days after it ends. Your coins are untouched."

Frontend
- Profile Pro tab (src/pages/Profile.jsx): status for free / coin Pro / paid Pro (shows the end date) / lapsed; Upgrade works for coin-Pro users ("Upgrade (keeps your Pro days)"); "Renew" after a lapse; downgrade button only for paid Pro; a headline banner "Earn Nx Arena Coins with Pro" with LIVE rates from the coins API (not hard-coded); link to redeem Pro days with coins.
- Tier cards list "Bonus Arena Coins on daily login & Dailies" (no number: the multiplier is admin-editable).
- Rewards "Go Pro" link now opens the Pro tab directly (/profile?tab=arenaxpro).

## Decisions I made (they answer your open question #4; easy to flip)
- Coin days and paid days are merged into one timeline, never stacked in parallel and never lost.
- Coin Pro can't be bought on top of an active paid Pro.
- Cancelling paid Pro does not touch coin days.

## Still true / not done
- There is no auto-renewal: a paid month lasts 30 days, then lapses and the user taps Renew. Recurring billing (Razorpay Subscriptions) would be a separate build.
- The Pro price comes from the `plans` table (gamer_pro row). Your pending decision #2 (what Pro costs) still needs making there.
- Real Razorpay checkout was not exercised (needs keys). Payments in tests use correctly signed callbacks through the real verifyPayment controller.

## Verified
- 54/54 tests pass against MariaDB 10.11 (37 earlier + 17 new in tests/pro-purchase.test.js).
- Mutation-checked: removing each of the six fixes (idempotency, cancel scope, expiry filter, coin-Pro protection, carry-over, overlap block) makes a test fail.
- The real Profile page was rendered in jsdom with mocked APIs for free, coin-only Pro, paid Pro, lapsed, and organizer-plan + coin-Pro users: correct status text, buttons and banner, no runtime errors; the downgrade button calls cancel.
- Not checked in a real browser or with live data.

## Files
src/controllers/paymentController.js, src/services/coinService.js,
frontend/src/pages/Profile.jsx, frontend/src/components/OrganizerTiers.jsx, frontend/src/pages/Rewards.jsx,
tests/pro-purchase.test.js, tests/helpers.js

## Cumulative note
coinService.js and Rewards.jsx also contain earlier work (ban handling, ledger, rewards-terms link); they supersede the copies in earlier zips.
