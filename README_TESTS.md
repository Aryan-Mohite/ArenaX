# Arena Coins integration tests

32 tests, Node's built-in runner (no new dependencies), real MySQL/MariaDB, no mocks.

## One-time setup
1. Create a throwaway database whose name ENDS IN `_test` (the suite refuses to run otherwise; it wipes users, ledger, redemptions, subscriptions, teams and coin settings between tests):
   `CREATE DATABASE arenax_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. Load `database/arenaX_schema_mysql.sql`, then the `migrations_section*.sql` files (1, 2, 2b, 4-11) and `migrations_college_cleanup.sql`. Duplicate-index errors from re-creating indexes the base schema already has are harmless.

## Run
    DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test

If the DB_* variables aren't set, the tests skip with a message instead of failing, so `npm test` is safe in environments without a database.

## What is covered
- Awarding: ref_key idempotency (incl. 10 parallel identical awards), login once/day, streak bonuses once, Dailies once/day, 0-amount earns
- Pro multiplier: doubles listed reasons only, monthly bonus cap, expired subscription ignored
- One-time coins: profile (bio + picture), first game, team join pending -> vests or reverses
- Redemption: affordability, eligibility (unverified / too new / banned / paused), monthly cash limit (rejected ones don't count), 3 simultaneous redeems with coins for 1 -> exactly 1, stock never oversold, Pro-days auto-fulfil + extend one subscription
- Rejection: refund via ledger credit (append-only), stock restored, no double reject, two simultaneous rejects refund once
- Exchange rate: >2x jump refused, audit row written, cash rewards reprice, Pro-days fixed
- Ban handling (freezeUserCoins) and admin manual adjustment (race-safe, validated)

## Verified
All 32 pass against MariaDB 10.11, 3 runs in a row. Also mutation-checked: removing the user-row lock, the double-reject guard, the UNIQUE-key idempotency, or the balance check each makes the relevant tests fail.
Not yet run on your Hostinger MySQL version.

## One production-code change
`src/config/db.js`: the 5-minute auth-cache sweep timer now calls `.unref()` so short-lived processes (tests, scripts) can exit. No effect on the running server.
