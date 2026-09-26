# §7 Referral & Ambassador System — delivery notes

## Depends on §3's app.js / validators.js

`src/app.js` and `src/utils/validators.js` in this zip are based on the §3
delivery (they already include the college-module additions), not on a
clean checkout. If you haven't applied the §3 zip yet: applying this one
gives you both §3 and §7's changes to those two files in one go. If you've
already applied §3: just overwrite with these — they're a superset, nothing
from §3 is lost.

Every other file here is §7-only.

## New files

- `database/migrations_section7_referrals.sql` — run this first.
- `src/services/referralService.js`
- `src/controllers/referralController.js`
- `src/routes/referralRoutes.js`

## Modified files

- `src/app.js` — mounts `referralRoutes` at `/api/referrals` (+ §3's mount).
- `src/controllers/authController.js` — `sendRegisterOtp` now accepts and
  stashes an optional `referral_code`; `verifyRegisterOtp` generates the new
  user's own referral code, resolves who referred them, and opens a
  `pending` reward row for that referrer.
- `src/utils/validators.js` — `referral_code` added to `validateRegister`
  (+ §3's `validateClaimCollege`/`is_inter_college`).

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section7_referrals.sql
```

Safe to re-run — same `information_schema`-guard pattern as §3's migration.
The last statement backfills a `referral_code` for every existing user (so
current players have something to share too), skipped for anyone who
already has one.

No new env vars, no new npm packages.

## Design decisions worth knowing about

- **Every user gets a referral code, not just curated ambassadors.** The
  roadmap's "ambassador dashboard" is really just what any user sees once
  they've referred someone — there's no separate ambassador role or
  approval step. Simpler, and it means a random player who tells a friend
  to join gets credit too, not only people you've hand-picked.
- **Activation is defined exactly as the roadmap specifies** — profile
  complete (bio + profile picture set) **and** a game selected
  (`user_game_profile` row exists) **and** joined a tournament or the
  community (registered a team for a tournament, or made a Nexus post).
  All three, computed live in `referralService.checkActivation` — no
  stored "is_activated" flag to fall out of sync.
- **No cron job.** Pending rewards are evaluated and credited lazily, the
  moment `GET /api/referrals/mine` is called — same "fire-and-forget /
  compute-on-read" preference as §3's leaderboard and standings, and there's
  nowhere near the volume yet to justify a scheduled job. If referral
  volume grows enough that ambassadors want to see credit land in real time
  rather than on their next dashboard visit, this is the one thing worth
  revisiting — trigger `creditActivatedReferrals` from the actual activation
  events (profile save, game profile upsert, tournament registration,
  community post) instead of only on dashboard read.
- **Reward currency is XP on `users.xp_balance`**, not a coupon/credit
  table — per the roadmap ("XP or credit, not cash, to avoid junk
  signups"). Nothing spends it yet; it's a balance, the same shape as
  achievements are unlock-only right now. Wiring XP to something spendable
  is out of scope for §7 itself.
- **An invalid/unknown referral code never blocks registration** — it's
  silently ignored (`resolveReferrer` returns `null`), matching the
  roadmap's framing of referrals as upside, not a gate.
- **One referral record per referred user** (`referred_user_id UNIQUE` on
  `referral_rewards`) — whoever's code they used at signup is locked in;
  there's no "steal the referral" path after the fact.

## Endpoints added

```
GET /api/referrals/mine/code   (auth) — { referral_code, xp_balance }
GET /api/referrals/mine        (auth) — full ambassador dashboard:
                                          summary (invited/activated/pending
                                          counts, total XP earned) + per-
                                          invitee status, and for still-
                                          pending invitees, which of the
                                          three activation criteria they're
                                          missing.

POST /api/auth/register/send-otp  { ..., referral_code }  (existing route,
                                     field added, optional)
```

## Not built (intentionally, per the roadmap's own scope)

- No leaderboard/ranking of ambassadors against each other — the roadmap
  only asks for each ambassador's own dashboard.
- No notification to the referrer when a reward gets credited — it just
  shows up next time they open the dashboard. Wiring into the existing
  `notifications` table would be a small, obvious follow-up if you want it.
- Frontend is untouched — the share-code widget, the dashboard page, and a
  `?ref=` query-param → registration-form prefill are frontend work on top
  of this.
