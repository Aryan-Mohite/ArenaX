# ArenaX: what's remaining (4 Oct 2026)

Checked against the `ArenaX-main.zip` code and the three older TODO files. Those files are partly stale; this one replaces them as the short list.

## Done since the audit
- [x] Per-user rate limits on `/api/coins/redeem` and redemption disputes
- [x] Live stream embedding (Twitch / Kick / YouTube) with a CSP allowlist
- [x] Tournament check-in (this zip): open/close, captain check-in, organizer override, finalize to no-show, real no-show and check-in rates in organizer analytics
- [x] Full suite: 112/112 pass on MariaDB 10.11 (97 earlier + 7 stream + 8 check-in)

## Needs you (not code)
- [ ] Rotate the old committed `.env` secrets and scrub git history (`git filter-repo` or BFG). `git rm --cached` is not enough
- [ ] Deploy and click through on the live site (Hostinger MySQL version, real SMTP, real Razorpay checkout and a real browser were never tested)
- [ ] Lawyer opinion on the coin/reward scheme (India online-gaming rules)
- [ ] Decide: Pro price, coin value (100 coins = Rs.1?), reward ladder, monthly cash budget, who funds the first gift cards
- [ ] Accounting treatment of rewards; gift-card supplier terms
- [ ] Rewrite the investor / IIE Cell pitch (drop the college ambassador thesis)

## Needs a decision, then I can build
- [ ] **Phone verification** for cash redemptions (your "last" item). Needs an SMS provider choice (MSG91, Twilio, ...) and credentials
- [ ] **Coins for verified outcomes**: now unblocked by check-in data. Decide the rule (e.g. N coins per checked-in tournament, capped per month) and how to stop free-tier organizers farming it
- [ ] **Clan / city / state leaderboards** (replace the college growth loop): decide what is ranked and the scope
- [ ] **Sponsor-funded quests**, **free-entry tournaments**: product design first

## Minor cleanup
- [ ] `apiKeyController.js` still returns `is_inter_college` (harmless; column kept on purpose)
- [ ] Delete `DELETE_THESE_FILES.txt` and the old per-section READMEs once deployed
