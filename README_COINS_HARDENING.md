# Coins hardening: ban handling + fulfilment emails

No DB migration needed. Copy files over the repo, commit, push, restart the API.

## Ban handling (`freezeUserCoins`, called from `banUser`)
In one transaction when an admin bans a user:
- open (requested/approved) redemptions are rejected, coins refunded, stock returned
- pending coins are marked `reversed`
- remaining available balance is zeroed by one `ban_reversal` ledger row (history is never edited)
- fulfilled redemptions are left alone; unbanning does NOT restore coins
- a failure here is logged and does not block the ban

## Fulfilment emails (`notifyRedemptionOutcome`)
- Sent after an admin fulfils or rejects a redemption; fire-and-forget, so missing SMTP never fails the admin action
- The gift card code is NOT emailed; the email links to /rewards where the logged-in user reads it
- Admin note is HTML-escaped

## Files
- src/services/coinService.js, src/utils/mailer.js
- src/controllers/adminCoinController.js, src/controllers/adminController.js
- frontend/src/pages/Rewards.jsx (label for `ban_reversal`)

## Verified / not verified
- Verified: node --check on all four backend files, `vite build` passes
- NOT verified: SQL paths against a real database (no DB in my sandbox). Test on staging: ban a user with a pending coin, an open redemption and some balance, then check the ledger, redemption status and stock. Also fulfil/reject one redemption with SMTP configured.
