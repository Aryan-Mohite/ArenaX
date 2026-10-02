# §11 — Arena Coins

Earn-only loyalty currency. Coins are awarded for achievements and spent on rewards (Pro days, gift cards, in-game top-ups). Never purchasable, never transferable.

## Install
1. Run `database/migrations_section11_coins.sql` (safe to re-run).
2. Copy the files in this zip over the repo, restart the API, let CI rebuild `frontend/dist`.
3. Admin → **Coins** tab to tune the economy. Users reach coins at `/rewards` (profile dropdown → Arena Coins).

## Defaults (all editable in Admin → Coins → Settings)
- Exchange rate: **100 coins = ₹1** (a single edit can't move it more than 2x; every change is audited).
- Earn: login 5, Dailies 10, profile complete 25, first game 25, team join 50 (vests after 7 days of membership), 7-day streak 50, 30-day streak 250.
- Pro: 2x on login + Dailies only, capped at 600 extra coins/month per user.
- Cash rewards (gift card / top-up) are priced in ₹, so changing the rate reprices them. Pro-day rewards have a fixed coin cost.
- Redemption gates: verified email, account >= 7 days old, max 2 cash redemptions per calendar month, admin review before delivery. Master switch: `redemptions_enabled`.

## How it works
- `coin_ledger` is append-only; balance = sum of `available` rows. `UNIQUE(user_id, ref_key)` makes every award idempotent (e.g. `login:2026-10-02`).
- Awards hook into: `updateLoginStreak` (login + check-in), Dailies completion, and `syncOneTimeCoins` (profile / first game / team join), which is also run whenever `/api/coins/me` is read, so a missed hook self-heals.
- Pro multiplier uses the existing `hasFeature(userId, 'coin_multiplier')`. Coin-bought Pro is a `subscriptions` row with `gateway = 'coins'`, so no other code changes.
- Rejecting a redemption refunds via a new ledger row, never by editing history.

## API
User: `GET /api/coins/me`, `GET /api/coins/ledger`, `POST /api/coins/redeem`, `GET /api/coins/redemptions`
Admin: `GET|PUT /api/admin/coins/settings`, `GET /api/admin/coins/stats`, `GET /api/admin/coins/redemptions`, `POST .../redemptions/:id/(approve|fulfil|reject)`, `GET|POST /api/admin/coins/catalog`, `PATCH /api/admin/coins/catalog/:id`

## Before real money goes out
- Keep coins earn-only. Get the loyalty/rewards setup checked against India's online gaming rules.
- Fulfilment is manual (admin pastes the code). A reward-catalog API can replace that later.
