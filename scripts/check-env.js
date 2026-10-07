// Usage: npm run check-env   (run on the server, from the project root)
// Reports missing / placeholder / weak environment values. NEVER prints a value.
import "../src/config/env.js";

const PLACEHOLDER = /^(|your_.*|replace_with.*|changeme|change_me|example|test|secret|password|smtp\.example\.com|you@example\.com|no-reply@yourdomain\.com)$/i;
const rows = [];
const add = (level, name, msg) => rows.push({ level, name, msg });
const v = (n) => (process.env[n] ?? "").trim();

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET", "CLIENT_URL", "ALLOWED_ORIGINS", "ADMIN_EMAILS"];
for (const n of required) {
  if (!v(n)) add("FAIL", n, "missing");
  else if (PLACEHOLDER.test(v(n))) add("FAIL", n, "still a placeholder value");
}
for (const n of ["JWT_SECRET", "SIGNAL_HASH_SECRET"]) {
  if (v(n) && v(n).length < 32) add("FAIL", n, `too short (${v(n).length} chars, need 32+)`);
  else if (v(n) && PLACEHOLDER.test(v(n))) add("FAIL", n, "still a placeholder value");
}
if (!v("SIGNAL_HASH_SECRET")) add("WARN", "SIGNAL_HASH_SECRET", "not set: falls back to JWT_SECRET, so rotating JWT_SECRET later would break IP-hash matching");
if (v("JWT_SECRET") && v("JWT_SECRET") === v("SIGNAL_HASH_SECRET")) add("WARN", "SIGNAL_HASH_SECRET", "same value as JWT_SECRET; use a different one");

// Email: the code reads SMTP_*; EMAIL_* names from the old .env.example do nothing.
for (const n of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
  if (!v(n) || PLACEHOLDER.test(v(n))) add("WARN", n, "missing/placeholder: verification and password-reset emails will not send");
}
if (["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS", "APP_URL"].some((n) => v(n)) && !v("SMTP_HOST"))
  add("WARN", "EMAIL_*/APP_URL", "set, but the code reads SMTP_* and CLIENT_URL instead. Rename them");

// Payments: all three or none.
const rz = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"].filter((n) => v(n));
if (rz.length && rz.length < 3) add("WARN", "RAZORPAY_*", `only ${rz.length} of 3 set: payments or the webhook will fail`);
if (v("RAZORPAY_KEY_ID").startsWith("rzp_test_") && v("NODE_ENV") === "production") add("WARN", "RAZORPAY_KEY_ID", "test key while NODE_ENV=production");
if (v("RAZORPAY_KEY_SECRET") && v("RAZORPAY_KEY_SECRET") === v("RAZORPAY_WEBHOOK_SECRET")) add("WARN", "RAZORPAY_WEBHOOK_SECRET", "same as the API key secret; they should be different");

if (v("NODE_ENV") !== "production") add("WARN", "NODE_ENV", `is "${v("NODE_ENV") || "unset"}", not production`);
if (/localhost|127\.0\.0\.1/.test(v("ALLOWED_ORIGINS")) && v("NODE_ENV") === "production") add("WARN", "ALLOWED_ORIGINS", "contains localhost in production");

const fails = rows.filter((r) => r.level === "FAIL").length;
for (const r of rows) console.log(`${r.level.padEnd(4)}  ${r.name.padEnd(22)} ${r.msg}`);
console.log(rows.length ? `\n${fails} failure(s), ${rows.length - fails} warning(s).` : "All checks passed.");
process.exit(fails ? 1 : 0);
