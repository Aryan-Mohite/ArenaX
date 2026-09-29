import { useState } from "react";
import { reportUser, reportTournament } from "../services/reportService";

const CATEGORIES = {
  user: [
    { v: "harassment", l: "Harassment or abuse" },
    { v: "cheating",   l: "Cheating" },
    { v: "spam",       l: "Spam or scam" },
    { v: "other",      l: "Something else" },
  ],
  tournament: [
    { v: "fake_tournament", l: "Fake or scam tournament" },
    { v: "no_show",         l: "Organizer no-show" },
    { v: "prize_issue",     l: "Prize not paid" },
    { v: "other",           l: "Something else" },
  ],
};

// §9: one modal for both player-side and organizer-side reports.
// <ReportModal type="user" targetId={id} targetLabel="@name" onClose={...} />
export default function ReportModal({ type, targetId, targetLabel, onClose, onDone }) {
  const [category, setCategory] = useState(CATEGORIES[type][0].v);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) return setError("Please describe what happened");
    setBusy(true);
    setError("");
    try {
      const fn = type === "user" ? reportUser : reportTournament;
      await fn(targetId, { reason: reason.trim(), category });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Couldn't submit your report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="font-display font-bold text-lg text-white mb-1">
          Report {type === "user" ? "player" : "tournament"}
        </h3>
        {targetLabel && <p className="text-xs text-gray-500 mb-3">{targetLabel}</p>}
        <select className="input w-full mb-3" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES[type].map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <textarea className="input w-full h-28" maxLength={1000} placeholder="What happened?"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="text-sm text-red mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-ghost text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-sm" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
