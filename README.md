# §3 College / Campus module — frontend patch

Files sit at their repo paths. NOTE: Profile.jsx / OrganizerTiers.jsx etc. from the §4 patch are NOT included;
`authController.js` here contains both the §4 change (profile_banner_url) and the §3 change (college_id) —
if you already applied §4, just add `college_id` to the getMe SELECT.

## New
- `services/collegeService.js` — wrappers for the existing /colleges and /tournaments/:id/college-standings APIs.
- `pages/Colleges.jsx` (/colleges) — public leaderboard (wins → members), search, "Claim your college" modal.
- `pages/College.jsx` (/colleges/:slug) — shareable college profile: stats, Official Partner badge, join/leave, share button, links to college-scoped tournaments and Team Finder.

## Modified
- `App.jsx` — routes /colleges and /colleges/:slug. `Navbar.jsx` — "Colleges" under More.
- `Tournament.jsx` — `?college_id=` filter (with dismissible chip); "Inter-college tournament" checkbox in the create form; College Standings panel on inter-college tournament pages.
- `TeamFinder.jsx` — `?college_id=` filter with dismissible chip.
- `admin/AdminDashboard.jsx` — new Colleges tab: approve/reject claims, grant/revoke annual license. Without this, claims could never go live.
- `authController.js` — getMe also returns `college_id` (needed to show Join vs Leave).

## Setup
No migrations/env/packages. `npm run build` passes.

## Notes
- The claim controller's comment says the claimer is auto-added as a member, but the code doesn't set `users.college_id`; after approval the claimer taps "Join this college" themselves. Easy backend follow-up if you want it automatic.
- Filtering is via links from the college page rather than a dropdown on Team Finder/Tournaments. A "My college" toggle is a quick add later.
- /colleges is not in the react-snap prerender list (it's live data).
