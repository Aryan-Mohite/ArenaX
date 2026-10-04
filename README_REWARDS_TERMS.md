# Arena Coins Rewards Terms page

Route: /rewards-terms (public, no login). No backend or DB changes.

## Wiring
- frontend/src/pages/RewardsTerms.jsx (new)
- frontend/src/App.jsx: lazy import + route
- frontend/src/components/Footer.jsx: "Rewards Terms" link next to Terms & Conditions
- frontend/src/pages/Rewards.jsx: link under the header; the redeem confirmation now says "By redeeming you agree to the Rewards Terms." (This file also contains the earlier ban_reversal label, so it supersedes the one in arenax-coins-hardening.zip.)
- frontend/package.json: "/rewards-terms" added to the react-snap prerender list

## Design notes
- Numbers an admin can change (coin prices, exchange rate, earn amounts, monthly limit, minimum account age, holding period) are NOT hard-coded in the text; the page points to the Rewards page for live values, so it can't go stale.
- "Last updated" is a fixed constant (LAST_UPDATED in the file). Bump it when the wording changes.
- Rules described match the code: earn-only coins, pending team-join coins, Pro multiplier + monthly cap, manual review of gift cards/top-ups, reject = refund, rejected requests don't count toward the monthly limit, code shown in-account never emailed, ban removes coins and cancels open redemptions.

## Needs your / a lawyer's decision before relying on it
1. Two commitments I wrote that you may not want: "at least 30 days' notice before any coins expire" and "reasonable notice of changes that materially reduce the value of coins already held".
2. Under-18 users: the site allows 13+, but the page says nothing about minors redeeming gift cards. Decide the rule (e.g. 18+ or guardian consent) and, if needed, enforce it in code.
3. No delivery-time promise is made; add one only if you can keep it.
4. Whether the program is acceptable under India's online gaming rules is for a lawyer; this page is a plain-language draft, not legal advice.
5. Existing pages disagree on contact addresses (legal@arenax.gg, privacy@arenax.gg, support@arenax.io). This page uses support@arenax.io (the footer address).
6. The existing /terms page shows today's date as "Last updated" (new Date()). Worth replacing with a fixed date.

## Verified
vite build passes; the page was server-rendered in a test harness: 13 sections, correct links. Not checked in a real browser.
