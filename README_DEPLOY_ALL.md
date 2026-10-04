# ArenaX: everything built in this session, in one zip

This zip is the single source of truth. It replaces all the earlier per-feature zips (their individual READMEs are included for detail). Copy it over your repo, then:

1. Back up the production database.
2. Delete the files in `DELETE_THESE_FILES.txt` (`git rm`).
3. Run the migrations, in this order (all are safe to re-run):
   - `database/migrations_section11_coins.sql`  (only if not already applied)
   - `database/migrations_college_cleanup.sql`
   - `database/migrations_referral_coins.sql`
   - `database/migrations_final_batch.sql`
4. Commit, push, restart the API (this also registers the new nightly coin job), let CI rebuild `frontend/dist`.
5. Optional: `DB_NAME=... npm test` against a throwaway database whose name ends in `_test` (see README_TESTS.md).

## What is in it (by area)
- College removal cleanup, Arena Coins hardening (ban handling, fulfilment emails), admin per-user ledger + manual adjustment, coin analytics, Rewards Terms page, ArenaX Pro purchase fixes, referrals paying coins.
- This final batch:
  - **Redemption disputes**: "Report a problem" on Rewards (delivered gift cards/top-ups, or requests waiting over 3 days); admin Disputes tab to send a new code, refund, or deny; emails the user.
  - **Monthly cash budget** (Admin -> Coins -> Settings, 0 = off): gift card / top-up requests are refused once the month's total reaches it, race-safe; warning at 80%; alert if max liability exceeds the budget.
  - **Nightly coin job** (03:15): vests due pending coins, optional coin expiry (`coin_expiry_days`, 0 = never, first-in-first-out), logs ledger anomalies. `node scripts/reconcileCoins.js` prints anomalies; the admin stats show a count.
  - **Redemption risk flags** in the admin queue (new account, earning unusually fast, many referral rewards, repeat redeemer, received admin grants) and an **accounting CSV export** (never includes gift card codes; spreadsheet-formula safe).
  - **Pro streak freeze** (one missed day forgiven, cooldown configurable) and a **free Team Finder boost** reward (300 coins, 24h; a coin sink that costs no cash).
  - Navbar coin balance pill, "+N coins" on the Dailies results, Gear page linked to Rewards, Privacy Policy section on coins/rewards data, Rewards Terms updated.

## Defaults you should confirm (all editable in Admin -> Coins -> Settings)
Referral 200 coins / 7-day hold / 10 per month; budget 0 (off); expiry 0 (off); streak-freeze cooldown 7 days; boost price 300 coins (edit in the catalog).

## Deliberately NOT built (and why)
- **Phone verification**: you scheduled it last. It is still the real fix for multi-account farming.
- **Coins for "verified outcomes"** (showing up to / finishing a tournament): there is no check-in or result data, and free-tier organizers could create tournaments and register their own accounts to farm coins. Needs organizer check-in or match results first.
- **Clan / city / state leaderboards, sponsor-funded quests, free-entry tournaments**: product designs, not code fixes (what is ranked, who funds it, what "free" means for prize pools).
- **Earn caps**: pointless until there are more repeatable earn sources.
- **Not code**: rotating the old committed secrets and scrubbing git history, the lawyer review of the rewards scheme, accounting treatment of rewards, picking the Pro price, and the pitch repositioning.

## Audit items that turned out to be already built (the old audit doc is stale)
Sponsor application form and admin placement manager, featured placements on the homepage and tournament list, Gear page, organizer terms gate (backend enforcement + accept modal), payment dispute button, referral dashboard, Gamer Pro purchase flow.

## Verified / not verified
- 97/97 integration tests pass on MariaDB 10.11. Every new safeguard (budget cap and its lock, dispute locking, FIFO expiry, CSV formula guard, streak cooldown, boost/Pro guard, refunded-not-counted) was mutation-checked: breaking it makes a test fail.
- The real Rewards page, admin Coins tab, Navbar and Dailies results were rendered in jsdom from real endpoint output (all states, error and empty cases).
- NOT verified: a real browser, your live data, your Hostinger MySQL version, real SMTP, real Razorpay checkout.
