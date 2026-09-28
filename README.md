# §5 Sponsorship — frontend patch

Frontend only. No backend, migration, env or package changes. `npm run build` passes.

## New
- `pages/Sponsor.jsx` (/sponsor) — sponsor pitch + application form; shows pending/approved/rejected status once applied. Nav: More → Sponsor.
- `components/FeaturedTournaments.jsx` — "Presented by <sponsor>" cards from `GET /tournaments/featured`. Renders nothing when there are no active placements. Placed at the top of the homepage content and above the Tournament list.
- `services/sponsorService.js`.

## Modified
- `services/tournamentService.js` — `getFeaturedTournaments`.
- `admin/AdminDashboard.jsx` — new **Sponsors** tab: pending applications (approve/reject), manual placement creation (tournament + approved sponsor + slot type + optional end date), activate/deactivate, and the participation insights (this vs last quarter, QoQ %, college-player share) that sponsors actually buy.
- `App.jsx`, `Navbar.jsx`, `Home.jsx`, `Tournament.jsx`.

## Cumulative files
`App.jsx`, `Navbar.jsx`, `Tournament.jsx`, `AdminDashboard.jsx` are the latest full versions and include the §3, §4, §6, §7, §8/§9 changes. Apply those patches first (or overwrite all together).

## Notes
- The tournament dropdown in the placement form uses the public `/tournaments` list, so only tournaments returned there can be picked.
- `banner` slot type can be created and stored, but only `featured_tournament` and `banner` placements both surface through the same featured list today (the backend doesn't distinguish them in `/featured`).
