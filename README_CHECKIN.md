# Tournament check-in

## Flow
1. Organizer (or admin) opens check-in on the tournament page. Every member of every registered team gets a notification.
2. Each team captain taps **Check in** for their team while it is open.
3. Organizer can check a team in by hand, undo it, and **Finalize**: check-in closes and teams that never checked in become `status = 'no_show'`. A manual check-in rescues a no-show (sets it to `confirmed`).
4. Organizer analytics now show a real **Checked in** % and **No-show** % (before, no-show was a stand-in using disqualified).

No coins are awarded. This only produces trustworthy attendance data (the prerequisite for outcome-based coins).

## Deploy
1. Back up the DB, run `database/migrations_checkin.sql` (safe to re-run; adds `tournaments.check_in_open`, `tournament_registrations.checked_in_at/checked_in_by`).
2. Copy the files over the repo, commit, push, restart the API, let CI rebuild `frontend/dist`.

## API
| Method | Path | Who |
|---|---|---|
| GET | `/api/tournaments/:id/check-in` | organizer: all teams + summary; others: teams they captain |
| PATCH | `/api/tournaments/:id/check-in` `{open}` | organizer/admin |
| POST | `/api/tournaments/:id/check-in` `{team_id}` | team captain |
| PATCH | `/api/tournaments/:id/check-in/teams/:teamId` `{checked_in}` | organizer/admin |
| POST | `/api/tournaments/:id/check-in/finalize` | organizer/admin |

## Files
New: `database/migrations_checkin.sql`, `src/controllers/checkInController.js`, `frontend/src/components/TournamentCheckIn.jsx`, `tests/checkin.test.js`.
Edited: `src/routes/tournamentRoutes.js` (5 routes), `src/controllers/tournamentController.js` (analytics only), `frontend/src/services/tournamentService.js` (5 calls appended), `frontend/src/pages/Tournament.jsx` (one import + one `<TournamentCheckIn />`), `frontend/src/pages/OrganizerDashboard.jsx` (Checked-in stat).
If any edited file changed in your repo since the zip, apply just those small edits by hand.

## Behaviour notes
- Only the team's captain (`team_members.role = 'captain'`) can check in. Plain members cannot.
- Externally-registered tournaments (join link) have no registrations here, so check-in shows "No teams registered yet".
- `no_show` is a new value in `tournament_registrations.status` (VARCHAR, no schema change). Announcements still reach no-show teams.

## Verified / not verified
- Verified: 8 new integration tests on MariaDB 10.11 (permissions, notify-once, captain rules, 10 simultaneous check-ins, finalize leaves disqualified alone, override, role-based GET, analytics rates). Whole suite 112/112. Removing the captain check, or the "not checked in" condition in finalize, makes tests fail. The conditional update on check-in is defence in depth and is not covered by a test.
- Verified: the component rendered in jsdom for captain / organizer / empty states and the buttons call the right endpoints; `vite build` passes.
- NOT verified: a real browser, your live data, your Hostinger MySQL version.
