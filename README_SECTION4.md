# §4 Premium Gamer Membership — delivery notes

Based directly on your uploaded repo state. No overlap with §5's files
(different controllers/routes entirely), so this applies independently of
whether §5 has been merged yet — either order is fine.

## New files

- `database/migrations_section4_premium_membership.sql` — run this first.

## Modified files

- `src/controllers/userController.js` — `getUserProfile` now returns
  `is_verified` and `profile_banner_url`; `updateProfile` accepts (and
  gates) `profile_banner_url`; new `getAdvancedStats`.
- `src/routes/userRoutes.js` — `GET /:id/advanced-stats`, gated by
  `requireFeature("advanced_stats")`.
- `src/utils/validators.js` — `profile_banner_url` added to
  `validateUpdateProfile`.
- `src/controllers/teamFinderController.js` — `getPosts` now returns
  `poster_verified`/`is_priority` per post and sorts Pro posters first.

## Setup

```
mysql -u DB_USER -p DB_NAME < database/migrations_section4_premium_membership.sql
```

Safe to re-run. No new env vars, no new npm packages. `gamer_pro` already
existed as a plan (inserted in §1) with `verified_badge`, `advanced_stats`,
and `priority_placement` in its `feature_flags` — none of them were wired
to anything until now. This migration only adds the fourth flag
(`profile_banner`, for the roadmap's "profile customization" bullet) that
§1 didn't include.

## Design decisions worth knowing about

- **The hard rule is respected everywhere**: Team Finder browsing,
  tournament browsing, and Community stay completely free and ungated.
  Every perk here either *reorders* what's already visible (priority
  placement — no post is hidden or delayed, just resorted) or *adds* an
  optional extra view on top (advanced stats, verified badge, banner) —
  nothing that was free before requires a subscription now.
- **`advanced_stats` gates the viewer, not the profile owner.** Anyone can
  still see anyone's basic profile and game stats for free
  (`GET /api/users/:id` is untouched). `GET /api/users/:id/advanced-stats`
  is a *new*, separate endpoint — the perk is that a Pro subscriber gets a
  deeper view of *whoever they're looking at* (elo percentile, recent match
  history, aggregate win/loss), useful for scouting a teammate. This is a
  judgment call — the roadmap doesn't specify whose plan should gate this,
  and framing it as a viewer perk was the more natural fit alongside
  priority placement (also about what the subscriber gets, not about
  restricting others).
- **`profile_banner_url` fails silently, not with an error**, mirroring the
  exact pattern §2 already established for the free-tier `max_teams` cap:
  "enforce, don't just suggest." If a non-Pro user sends
  `profile_banner_url` in a `PUT /api/users/me`, it's simply not applied —
  the rest of the update (username, bio, etc.) still goes through
  normally. No 403, no partial-failure response to handle on the frontend.
- **Priority placement and the verified badge are computed with a
  correlated `EXISTS` subquery in the listing query itself**, not via
  `hasFeature()` called per row — calling the service function in a loop
  over N Team Finder posts would be an N+1 query pattern. `hasFeature()`
  is still used as-is for single-resource checks (the profile endpoint,
  `updateProfile`) where there's no listing to loop over.
- **Elo percentile is computed live**, same "no new table for a derived
  number" convention used throughout this project (college leaderboard,
  referral activation, inter-college standings) — `(rank among users with
  a profile for this game) / (total users with a profile for this game)`,
  per game.
- **Match history reads through `team_members`**, so it reflects whoever
  is *currently* on the team, not who was on it at match time — same
  approximation §7's `checkActivation` already makes for "joined a
  tournament." Worth revisiting if teams start seeing significant roster
  churn and this stops feeling accurate.

## Endpoints added/changed

```
GET /api/users/:id                    — now includes is_verified, profile_banner_url
GET /api/users/:id/advanced-stats     — NEW, requires viewer to be ArenaX Pro
PUT /api/users/me                     — now accepts profile_banner_url (Pro-gated)
GET /api/teamfinder                   — posts now include poster_verified,
                                          is_priority; Pro posters sort first
```

## Not built (intentionally, per the roadmap's own scope)

- No actual payment flow difference — `gamer_pro` reuses §1's existing
  `plans`/`subscriptions`/Razorpay checkout entirely, exactly as the
  roadmap says ("reuse §1's plan/subscription tables; this is the simplest
  tier to add once payments exist"). Nothing new to build there.
- No banner *rendering* — this is the data layer (`profile_banner_url`
  stored and gated); actually displaying it on the profile page, and the
  upload/crop UI for it, is frontend work on top of this.
- No verified-badge or priority-placement UI — same story, this is the API
  surface (`is_verified`, `poster_verified`, `is_priority`) for the
  frontend to render a badge/highlight from.
