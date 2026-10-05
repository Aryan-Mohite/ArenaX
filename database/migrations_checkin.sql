-- Tournament check-in (safe to re-run; same ADD COLUMN IF NOT EXISTS style as the rest of the repo).
-- tournaments.check_in_open        : organizer opens/closes the check-in window
-- tournament_registrations.checked_in_at / checked_in_by : who checked the team in and when
-- Registration status gains a new value 'no_show' (status is VARCHAR, no schema change needed).
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS check_in_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournament_registrations
  ADD COLUMN IF NOT EXISTS checked_in_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS checked_in_by INT NULL;
