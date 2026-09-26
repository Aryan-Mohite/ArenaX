# Organizer tiers: 4 → 2, click-to-expand cards, Arena upsell

## Root cause of "4 tiers"
`GET /api/payments/plans` returned every row in `plans` with no filtering —
so the organizer upgrade modal showed **Free, Pro, Organization, and
ArenaX Pro (the gamer membership)** all mixed together. That's the 4th tier
you were seeing; `gamer_pro` was never meant to appear there.

## What changed

**1. Backend — `src/controllers/paymentController.js`**
`getPlans` now accepts `?category=organizer` and filters by the
`plan_key` prefix (`organizer_%`). Callers that don't pass a category keep
the old behavior, so nothing else breaks.

**2. DB — `database/migrations_section2b_tier_consolidation.sql`** (new, run after this)
Folds the Organization tier's two extra flags (`multi_tournament_dashboard`,
`api_access`) into `organizer_pro`, then deactivates `organizer_org`
(`is_active = FALSE`, not deleted — history stays intact). Any user
currently on an active `organizer_org` subscription is moved onto Pro in
the same migration so nobody loses access.
Nothing else in the codebase checks `plan_key` directly (it's all
`feature_flags` via `hasFeature()`), so this is safe to run as-is.

**3. Frontend service — `frontend/src/services/paymentService.js`**
`getPlans(category)` now forwards the category to the API.

**4. New — `frontend/src/components/OrganizerTiers.jsx`**
Shared pieces for both surfaces below:
- `ORGANIZER_TIER_CONTENT` — curated copy/feature list per tier (Free vs Pro).
- `TierCard` — a click-to-expand card. Collapsed shows name/price/tagline;
  clicking anywhere (or "See what's included") expands the full feature
  breakdown with ✓/— per line. Pro gets a highlighted border, glow, and a
  "Most Popular" badge.
- `OrganizerTierSection` — self-contained promo block: fetches the 2
  organizer plans (+ the viewer's current plan, if signed in) and renders
  the tier grid with a CTA. Renders nothing if the fetch fails, so it can
  never break the page it's dropped into.

**5. `frontend/src/pages/Tournament.jsx` (The Arena)**
Dropped `<OrganizerTierSection />` in between the hero and the filter bar.
Signed-out visitors get "Sign In to Get Started"; signed-in organizers get
"Upgrade in Dashboard →" (checkout itself still lives in the dashboard, so
there's only one Razorpay flow in the codebase); Pro organizers see a small
"⚡ You're on Pro" badge instead of an upgrade prompt.

**6. `frontend/src/pages/OrganizerDashboard.jsx`**
- `getPlans()` → `getPlans("organizer")`.
- `PlansModal` rebuilt on top of the shared `TierCard` — same
  click-to-expand cards as the Arena page, just 2 tiers now, with the
  actual "Select" → Razorpay checkout button as the CTA.
- Cleaned up stale "Pro/Org" copy in the downgrade-confirmation text and a
  comment that referenced the now-retired Org tier.

## Apply order
1. Drop these files into place (same paths as above).
2. Run `database/migrations_section2b_tier_consolidation.sql` against the DB.
3. `npm run build` in `frontend/` as usual (already verified clean locally —
   no new warnings, `OrganizerTiers` came out as its own ~6 KB chunk).

## Not touched / worth knowing
- No changes to `hasFeature`/`requireFeature` — merging the flags into Pro
  means every existing gate (`branded_page`, `analytics`, `announcements`,
  `multi_tournament_dashboard`, `api_access`) keeps working unmodified.
- `gamer_pro` (ArenaX Pro membership) is untouched and just no longer shows
  up where it shouldn't have.
- If you want the Organization tier back later (once §3 college licensing
  needs it), it's a straight reversal: flip `is_active` back to `TRUE` and
  drop the two flags back out of `organizer_pro` if you want them
  Org-exclusive again.
