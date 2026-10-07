# ArenaX: secret rotation and git history scrub

**The one rule:** once a secret has been in a commit, treat it as stolen. Anyone who ever cloned,
forked or cached the repo still has it. So **rotation is the real fix**; scrubbing history is
cleanup that stops new people finding it. Do them in this order: rotate, verify, then scrub.

What I could and could not check: your zip has **no `.git` folder**, so I could not see your history.
The *current* files contain no hardcoded keys (I scanned for Razorpay, AWS, Google, GitHub,
private-key and database-URL patterns). Whether an old `.env` is buried in history is something only
a scan of your real repo can tell you (Phase 2). I also do not know whether the repo is public or private.

**If the repo has always been private and only you (and teammates you trust) have access:** Phases 1
and 4 are essential, Phase 3 is optional hygiene. **If it is or ever was public:** do everything,
and assume the secrets are already harvested.

Time needed: about 1 to 2 hours. Pick a quiet time; users will be logged out and the site restarts briefly.

---

## Phase 0: prepare (10 min)
- [ ] Write down the date the `.env` was first committed (Phase 2 tells you). Everything since then is the "exposure window" you check in Phase 5.
- [ ] Open the server's `.env` in one tab and the dashboards below in other tabs.
- [ ] Turn on 2-factor login for: GitHub, Hostinger, Razorpay, your email/SMTP provider, PandaScore.

## Phase 1: rotate every secret (45 min)
For each: change it at the provider **and** in the server `.env` in the same sitting, then restart the Node app.

| Secret | Where to change it | What happens / watch out |
|---|---|---|
| `DB_PASSWORD` | Hostinger hPanel > Databases > Management > change password for the DB user | Site is down until `.env` matches and the app restarts. Do these two steps back to back |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Logs every user out once. Expected and harmless |
| `SIGNAL_HASH_SECRET` | Generate the same way, a different value | Set it ONCE now. Changing it later makes old IP hashes stop matching (device IDs are unaffected) |
| `SMTP_PASS` | Your email provider (change the mailbox / SMTP password) | Verification and reset emails fail until `.env` is updated |
| `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_KEY_ID`) | Razorpay dashboard > Account & Settings > API Keys > Regenerate. Do **Live and Test separately** | The old key stops working immediately. Update `.env` straight away. Use a live key only with `NODE_ENV=production` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay > Settings > Webhooks > edit the webhook > set a new secret | Webhooks fail between the dashboard change and the `.env` change; Razorpay retries, so keep the gap short |
| `PANDASCORE_API_KEY` | PandaScore dashboard > regenerate | The daily sync fails until updated |
| Admin accounts | Accounts listed in `ADMIN_EMAILS` | Change their passwords; remove any email you no longer recognise |
| Anything else ever pasted into the repo | GitHub personal access tokens, deploy keys, Hostinger SSH keys, Google keys | Revoke and recreate |

Then on the server:
- [ ] Update `.env` using the corrected `.env.example` from this zip (the old one had the wrong variable names, so email was silently disabled).
- [ ] Run `npm run check-env`. It lists missing, placeholder or weak values and never prints a secret. Fix every FAIL.
- [ ] Restart the app.
- [ ] Confirm `.env` is not downloadable: open `https://arenax.io/.env` and `https://arenax.io/.git/config` in a browser. Both must be 404 or 403, never file contents.

## Phase 2: verify the old secrets are dead, and find what leaked (20 min)
- [ ] Old DB password: try to connect with it; it must be refused.
- [ ] Old Razorpay key: a call with it must return 401.
- [ ] Log in, register a test account (email arrives), and make a Razorpay **test** payment; confirm the webhook arrives.
- [ ] Find out what is in history. Work in a **fresh clone on your own computer**, not the server:
```
git clone https://github.com/<you>/ArenaX.git scan && cd scan
git log --all --full-history --oneline -- .env '.env.*' '*/.env' | cat
git log --all --oneline -S"JWT_SECRET=" | cat
```
- [ ] Run a real scanner over every commit (either one):
```
gitleaks detect --source . --log-opts="--all" -v
trufflehog git file://. --only-verified
```
- [ ] Write down every file path and commit that shows a secret. You need the exact paths for Phase 3. Anything the scanner finds that you rotated in Phase 1 is now harmless; anything it finds that you did **not** rotate is a gap, so go back and rotate it.

## Phase 3: scrub history (30 min, only after Phases 1 and 2)
**This rewrites every commit. Coordinate with your teammate (Aditya): after you force-push, everyone must delete their clone and clone again. Do not merge old work into the new history.**
- [ ] Backup first: `git clone --mirror https://github.com/<you>/ArenaX.git ArenaX-backup.git`
- [ ] Install git-filter-repo (`pip install git-filter-repo`), then in a **fresh** clone:
```
# remove the exact file paths found in Phase 2 (do NOT use a '.env.*' glob: it would also delete .env.example)
git filter-repo --invert-paths --path .env --path backend/.env
# if a secret sits inside some other file, replace its text instead:
#   replacements.txt:  the_leaked_value==>REMOVED
git filter-repo --replace-text replacements.txt
```
- [ ] Re-add the remote (filter-repo removes it) and force-push everything:
```
git remote add origin https://github.com/<you>/ArenaX.git
git push origin --force --all
git push origin --force --tags
```
- [ ] Re-run the scanner on a new fresh clone; it must find nothing.
- [ ] If the repo is or was public: GitHub keeps old commits reachable by their ID and in pull-request references. Ask GitHub Support to remove cached views and run a garbage collection for the repo, and delete or rewrite any forks you control.
- [ ] Hostinger: your deployed copy still has the old history. In hPanel > Git, redeploy (or on the server `git fetch origin && git reset --hard origin/main`). Check the site still loads: `frontend/dist` is tracked in git, so expect a large diff, which is normal.

## Phase 4: stop it happening again (15 min)
- [ ] Keep `.env` in `.gitignore` (it already is) and never paste real values into `.env.example`, READMEs or issues.
- [ ] GitHub > Settings > Code security: turn on **secret scanning** and **push protection** (free for public repos; paid for private ones). If you cannot, use the scanner locally:
```
gitleaks protect --staged     # run before each commit; can be wired as a pre-commit hook
```
- [ ] Run `npm run check-env` after every `.env` edit and after each deploy.
- [ ] Keep production secrets in the Hostinger server only; use different values for local development.

## Phase 5: check nothing bad happened during the exposure window (30 min)
Look from the date in Phase 0 until now.
- [ ] Razorpay: transactions, refunds, settlements and payout destinations. Anything you do not recognise: report to Razorpay support immediately.
- [ ] Email provider: sent-mail log for messages you did not send.
- [ ] Database (Hostinger phpMyAdmin), run these and look for oddities:
```
SELECT user_id, email, created_at FROM users ORDER BY created_at DESC LIMIT 50;
SELECT user_id, delta, reason, created_at FROM coin_ledger WHERE reason = 'admin_adjust' ORDER BY created_at DESC LIMIT 50;
SELECT redemption_id, user_id, status, created_at FROM redemptions ORDER BY created_at DESC LIMIT 50;
SELECT user_id, plan_id, status, gateway, created_at FROM subscriptions ORDER BY created_at DESC LIMIT 50;
```
  Watch for: new accounts you cannot explain, coin grants you did not make, redemptions that were not requested through the site, subscriptions with no payment.
- [ ] Admin dashboard > Coins > Redemptions: check the risk flags and the linked-accounts card on anything large.

## Done when
- [ ] Every secret in Phase 1 is rotated, the site and payments work, `npm run check-env` is clean.
- [ ] `/.env` and `/.git/config` return 404 or 403.
- [ ] A fresh scan of the history finds nothing (or you chose to skip Phase 3 because the repo was always private).
- [ ] Teammates have re-cloned.
