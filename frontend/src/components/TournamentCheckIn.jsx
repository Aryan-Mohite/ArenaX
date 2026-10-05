import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getCheckIn, setCheckInOpen, checkInTeam, setTeamCheckIn, finalizeCheckIn,
} from "../services/tournamentService";

// Attendance check-in card for the tournament detail page.
//   Organizer / admin: open/close check-in, see who is in, override, finalize.
//   Team captain:      "Check in" button per registered team while check-in is open.
//   Everyone else:     renders nothing.
export default function TournamentCheckIn({ tournament }) {
  const { isAuthenticated } = useAuth();
  const id = tournament?.tournament_id;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || !id) return;
    try {
      const r = await getCheckIn(id);
      setData(r.data);
    } catch {
      setData(null);
    }
  }, [isAuthenticated, id]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fn();
      setMsg(typeof okMsg === "function" ? okMsg(r.data) : okMsg || "");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.message || "Something went wrong");
    } finally {
      setBusy(false);
      setConfirmFinalize(false);
    }
  };

  if (!data) return null;
  const finished = ["completed", "cancelled"].includes(tournament.status);

  // ── Captain view ──────────────────────────────────────────────────────────
  if (data.role === "captain") {
    if (!data.my_teams.length || (!data.check_in_open && !data.my_teams.some((t) => t.checked_in_at))) return null;
    return (
      <div className="card mb-6">
        <h2 className="font-display font-bold text-lg text-white mb-1">Check-in</h2>
        <p className="text-sm text-gray-400 mb-3">
          {data.check_in_open
            ? "Check-in is open. Confirm your team is here and ready."
            : "Check-in is closed."}
        </p>
        {msg && <p className="text-sm text-gray-300 mb-2" role="status">{msg}</p>}
        <div className="flex flex-col gap-2">
          {data.my_teams.map((t) => {
            const out = t.status === "no_show" || t.status === "disqualified";
            return (
              <div key={t.team_id} className="flex items-center justify-between gap-3 bg-navy rounded-xl px-4 py-3">
                <span className="text-white text-sm font-medium truncate">{t.team_name}</span>
                {t.checked_in_at ? (
                  <span className="text-green-400 text-sm shrink-0">✓ Checked in</span>
                ) : out ? (
                  <span className="text-red text-sm shrink-0">{t.status === "no_show" ? "Marked no-show" : "Disqualified"}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary text-sm shrink-0"
                    disabled={busy || !data.check_in_open}
                    onClick={() => run(() => checkInTeam(id, t.team_id), "Team checked in")}
                  >
                    Check in
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Organizer view ────────────────────────────────────────────────────────
  if (data.role !== "organizer") return null;
  if (finished && !data.teams.length) return null;
  const s = data.summary;

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-bold text-lg text-white">Check-in</h2>
          <p className="text-sm text-gray-400">
            {s.checked_in} of {s.total} teams checked in{s.no_show ? ` · ${s.no_show} no-show` : ""}
            {" · "}{data.check_in_open ? "open" : "closed"}
          </p>
        </div>
        {!finished && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={data.check_in_open ? "btn-secondary text-sm" : "btn-primary text-sm"}
              disabled={busy}
              onClick={() =>
                run(
                  () => setCheckInOpen(id, !data.check_in_open),
                  (d) => (d.check_in_open ? `Check-in opened. ${d.notified} players notified.` : "Check-in closed.")
                )
              }
            >
              {data.check_in_open ? "Close check-in" : "Open check-in"}
            </button>
            {confirmFinalize ? (
              <>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy}
                  onClick={() => run(() => finalizeCheckIn(id), (d) => `Finalized. ${d.marked_no_show} team(s) marked no-show.`)}
                >
                  Yes, mark absent teams
                </button>
                <button type="button" className="btn-ghost text-sm" onClick={() => setConfirmFinalize(false)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="btn-secondary text-sm" disabled={busy || !data.teams.length} onClick={() => setConfirmFinalize(true)}>
                Finalize
              </button>
            )}
          </div>
        )}
      </div>

      {confirmFinalize && (
        <p className="text-xs text-gray-400 mb-3">
          This closes check-in and marks every team that has not checked in as a no-show. You can still check a team in by hand afterwards.
        </p>
      )}
      {msg && <p className="text-sm text-gray-300 mb-3" role="status">{msg}</p>}

      {data.teams.length === 0 ? (
        <p className="text-sm text-gray-500">No teams registered yet.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {data.teams.map((t) => (
            <div key={t.team_id} className="flex items-center justify-between gap-3 bg-navy rounded-xl px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{t.team_name}</p>
                <p className="text-xs text-gray-500">
                  {t.checked_in_at ? "Checked in" : t.status === "no_show" ? "No-show" : t.status === "disqualified" ? "Disqualified" : "Not checked in"}
                </p>
              </div>
              {t.status !== "disqualified" && (
                <button
                  type="button"
                  className="btn-ghost text-xs shrink-0"
                  disabled={busy}
                  onClick={() => run(() => setTeamCheckIn(id, t.team_id, !t.checked_in_at))}
                >
                  {t.checked_in_at ? "Undo" : "Check in"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
