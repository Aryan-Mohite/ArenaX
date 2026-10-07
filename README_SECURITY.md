# Security hardening kit

- `SECURITY_ROTATION_CHECKLIST.md`: step-by-step secret rotation and git-history scrub, in the right order (start here)
- `.env.example`: **corrected**. The old one used `EMAIL_*` / `APP_URL` but the code reads `SMTP_*` / `CLIENT_URL`, so anyone setting up from it had email silently disabled. It also lacked `ADMIN_EMAILS` (no admin access without it), `ALLOWED_ORIGINS` and `SIGNAL_HASH_SECRET`
- `scripts/check-env.js`: run `npm run check-env` on the server to list missing, placeholder or weak values. It never prints a secret. Exit code 1 if anything fails

## One manual edit
Add this line to the `"scripts"` section of `package.json` (I did not ship the whole file so I cannot disturb your other changes):
```
"check-env": "node scripts/check-env.js",
```

## What was verified
- Current repo files scanned for hardcoded Razorpay, AWS, Google, GitHub, private-key and DB-URL secrets: none found.
- `check-env` tested with a deliberately bad environment (4 failures, 8 warnings, exit code 1) and a good one (clean, exit 0).
- NOT checked: your git history (the zip has no `.git`), whether the repo is public, and your live server's `.env`.
