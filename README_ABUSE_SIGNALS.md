# Abuse signals: device + IP checks (instead of SMS verification)

Catches one person farming coins with many accounts, without an SMS provider.
IP is only a weak flag; the device ID is the strong signal.

## What it does
1. **Logs signals** at signup, login and redeem: a random browser device ID, an HMAC-hashed IP (IPv6 reduced to /64; the raw IP is never stored) and a short user-agent hash. Auto-deleted after 90 days (nightly coin job, setting `signal_retention_days`).
2. **Rule: one gift card / top-up per DEVICE per month**, counted across every account that used that device. Error code `DEVICE_LIMIT`, coins untouched, message tells shared-device users to contact support. Admin setting `cash_redemptions_per_device_per_month` (default 1, 0 = off). Pro days and boosts are not affected.
3. **Rule: no referral coins when referrer and friend share a device.** Reward is marked `blocked` (not retried, not paid).
4. **Admin flags** in the Redemptions queue: "Shares a device with other accounts" and "3+ accounts signed up from the same IP". Flags never block anything by themselves.
5. **Linked accounts** card at the top of the user's coin-ledger page (click a name to jump to that account). Shows usernames only, never IPs.
6. **Privacy Policy** updated (sections 3 and 4). Frontend sends an `X-Device-Id` header on every request; id is kept in localStorage AND a first-party cookie `ax_did` so clearing only one does not reset it.

## Deploy
1. Back up the DB; run `database/migrations_signals.sql` (safe to re-run).
2. Optional but recommended: add `SIGNAL_HASH_SECRET=<long random string>` to `.env` (otherwise `JWT_SECRET` is used). Changing it later makes old IP hashes stop matching.
3. Copy the files over the repo, commit, push, restart the API, let CI rebuild `frontend/dist`.
Two of the edits are small changes inside big files (`AdminDashboard.jsx`: flag labels + a Linked-accounts card; `PrivacyPolicy.jsx`: two short paragraphs). If those changed in your repo since the zip, apply just those parts by hand.

## Honest limits
- A determined farmer can beat the device ID by using incognito / clearing both storage and cookies, or different devices. This stops casual multi-accounting (many accounts on one phone or laptop), not a motivated attacker. Phone verification remains the stronger option if gift-card volume ever justifies it. Your monthly cash budget and the manual approval queue still cap the damage.
- Shared devices (siblings, a college lab PC) will hit `DEVICE_LIMIT` once a month; the message points them to support, and an admin can approve by hand (or raise the setting).
- Accounts only get a device on record at their next login/signup/redeem. The redeem endpoint records it first, so the rule still covers people who have not logged in since you deploy.
- "One redemption per payout destination" was skipped on purpose: gift-card codes are delivered inside the site, so there is no UPI/email destination to compare.
- IP-based flags are noisy (hostels, mobile carriers share addresses), which is why they only flag.

## Verified / not verified
- Verified (MariaDB 10.11, real DB): 10 new tests, whole suite 122/122. Disabling either rule makes tests fail. Covers: hashes not raw IPs, bad device IDs rejected, IPv6 /64, per-device rule (incl. shared IP alone never blocks, reject frees the device, setting 0 = off), redeem endpoint, referral blocking and no double pay, flag thresholds incl. the 2-vs-3 boundary, linked accounts, purge.
- Verified: device-id logic in a simulated browser (stable id, survives clearing localStorage, bad stored value replaced); `vite build` passes.
- NOT verified: a real browser, your Hostinger MySQL version, the admin UI visually (compiled, not looked at), real traffic behind your proxy (`trust proxy` is set to 1 hop).
