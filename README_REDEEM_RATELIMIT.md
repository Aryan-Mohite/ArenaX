# Redeem rate limiter (Arena Coins)

## What changed
One file: `src/routes/coinRoutes.js`

- `POST /api/coins/redeem`: 5 attempts per user per 10 minutes
- `POST /api/coins/redemptions/:id/dispute`: 5 per user per hour
- Counted per authenticated user id (not IP), so shared networks don't block each other.
- Blocked requests get HTTP 429 with a friendly message.
- Limits are the `redeemLimiter` / `disputeLimiter` lines near the top of the file.

## Deploy
1. Copy `src/routes/coinRoutes.js` over the same path in your repo.
2. Commit, push, restart the API.
3. No migration and no frontend change needed.

## Verified / not verified
- Verified: limiter logic in a small Express app (6th request blocked, other user unaffected); file passes a syntax check.
- Not verified: inside the full app against a live DB; the 97-test suite was not run.
- Counts are in memory, so a server restart resets them (fine for a single Node process).
