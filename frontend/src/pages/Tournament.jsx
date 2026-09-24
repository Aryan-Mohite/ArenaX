import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getTournaments,
  getTournamentById,
  createTournament,
  deleteTournament,
} from "../services/tournamentService";
import { getMyGames } from "../services/gameService";
import { PageLoader, ErrorMessage } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";
import SEO from "../components/SEO";
// ── Shared helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  upcoming: {
    cls: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    dot: "bg-blue-400",
  },
  ongoing: {
    cls: "bg-green-500/15 text-green-400 border-green-500/25",
    dot: "bg-green-400 animate-pulse",
  },
  completed: {
    cls: "bg-white/8 text-gray-400 border-white/12",
    dot: "bg-gray-500",
  },
  cancelled: { cls: "bg-red/15 text-red-light border-red/25", dot: "bg-red" },
};
const FORMAT_LABELS = {
  single_elimination: "Single Elim",
  double_elimination: "Double Elim",
  TDM: "TDM",
  _5v5: "5v5",
  Battle_Royale: "Battle Royale",
  Round_Robin: "Round Robin",
  League: "League",
  Swiss: "Swiss",
  Group_Stage: "Group Stage",
  Knockout: "Knockout",
  Qualifiers: "Qualifiers",
  Playoffs: "Playoffs",
  Championship: "Championship",
};
// Same set, used to populate the "Format" <select> in the post form.
// Keys here must match the values TournamentCard.jsx (and the backend) expect.
const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS);
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.upcoming;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border " +
        s.cls
      }
    >
      <span className={"w-1.5 h-1.5 rounded-full " + s.dot} />
      {status}
    </span>
  );
}
function fmt(d, opts) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-US", opts);
}
function fmtMoney(v) {
  return v > 0 ? "$" + Number(v).toLocaleString() : null;
}

// ── Organizer Post Form ───────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "",
  game_id: "",
  prize_pool: "",
  entry_fee: "0",
  region: "",
  format: "single_elimination",
  start_date: "",
  end_date: "",
  registration_deadline: "",
  image_url: "",
  description: "",
  organizer_name: "",
  location: "",
  join_link: "",
};

function OrganizerPostModal({ games, onClose, onCreated }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = basics, 2 = details, 3 = media

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) return setError("Tournament name is required");
    if (!form.game_id) return setError("Please select a game");
    if (!form.start_date) return setError("Start date is required");
    if (!form.end_date) return setError("End date is required");
    if (!form.organizer_name.trim())
      return setError("Organizer name is required");
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        game_id: Number(form.game_id),
        format: form.format || "single_elimination",
        start_date: form.start_date,
        end_date: form.end_date,
        registration_deadline: form.registration_deadline || undefined,
        prize_pool: Number(form.prize_pool) || 0,
        entry_fee: Number(form.entry_fee) || 0,
        region: form.region.trim() || undefined,
        organizer_name: form.organizer_name.trim() || undefined,
        location: form.location.trim() || undefined,
        description: form.description.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        join_link: form.join_link.trim() || undefined,
      };
      const res = await createTournament(payload);
      onCreated(res.data.tournament);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors?.length) {
        setError(
          data.errors.map((e) => `${e.field}: ${e.message}`).join(" · "),
        );
      } else {
        setError(data?.message || "Failed to create tournament");
      }
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ["Basics", "Details", "Media & Links"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={ts.modalBackdrop}
    >
      <div
        className="w-full max-w-2xl my-4 rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={{
          background: "linear-gradient(145deg,#1a2340,#131a2e)",
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.12),0 32px 100px rgba(0,0,0,0.7)",
        }}
      >
        {/* Modal header */}
        <div
          className="relative px-6 pt-6 pb-4 border-b border-surface-border"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.1) 0%,transparent 60%)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle,rgba(255,70,85,0.15) 0%,transparent 70%)",
              transform: "translate(30%,-30%)",
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            &#10005;
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red/15 border border-red/25 flex items-center justify-center text-2xl shrink-0">
              &#127942;
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white">
                Forge a Tournament
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Fill in your event details for the community
              </p>
            </div>
          </div>
          {/* Step pills */}
          <div className="flex gap-2 mt-4">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i + 1)}
                className={
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all " +
                  (step === i + 1
                    ? "bg-red text-white"
                    : step > i + 1
                      ? "bg-green-500/15 text-green-400 border border-green-500/20"
                      : "bg-white/5 text-gray-500 border border-white/10")
                }
              >
                {step > i + 1 ? (
                  <span>&#10003;</span>
                ) : (
                  <span className="font-mono">{i + 1}</span>
                )}
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          <ErrorMessage message={error} />

          {/* Step 1 — Basics */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Tournament Name <span className="text-red">*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. South Asia Valorant Invitational 2025"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Game <span className="text-red">*</span>
                  </label>
                  <select
                    className="input"
                    value={form.game_id}
                    onChange={(e) => set("game_id", e.target.value)}
                  >
                    <option value="">Select a game</option>
                    {games.map((g) => (
                      <option key={g.game_id} value={g.game_id}>
                        {g.game_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Format
                  </label>
                  <select
                    className="input"
                    value={form.format}
                    onChange={(e) => set("format", e.target.value)}
                  >
                    {FORMAT_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Organizer Name <span className="text-red">*</span>
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. ESL India, Nodwin Gaming"
                    value={form.organizer_name}
                    onChange={(e) => set("organizer_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Region
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. South Asia, NA, EU"
                    value={form.region}
                    onChange={(e) => set("region", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Location
                </label>
                <input
                  className="input"
                  placeholder="e.g. Mumbai, India  /  Online"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Dates & Prize */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Start Date <span className="text-red">*</span>
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => set("start_date", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    End Date <span className="text-red">*</span>
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => set("end_date", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Registration Deadline
                </label>
                <input
                  className="input"
                  type="date"
                  value={form.registration_deadline}
                  onChange={(e) => set("registration_deadline", e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Prize Pool (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">
                      $
                    </span>
                    <input
                      className="input pl-7"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.prize_pool}
                      onChange={(e) => set("prize_pool", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Entry Fee (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">
                      $
                    </span>
                    <input
                      className="input pl-7"
                      type="number"
                      min="0"
                      placeholder="0 = Free"
                      value={form.entry_fee}
                      onChange={(e) => set("entry_fee", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="Describe the tournament — rules, eligibility, schedule, prizes breakdown..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3 — Media & Links */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Banner Image URL
                </label>
                <input
                  className="input"
                  placeholder="https://i.imgur.com/your-banner.jpg"
                  value={form.image_url}
                  onChange={(e) => set("image_url", e.target.value)}
                />
                {form.image_url && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-surface-border h-36">
                    <img
          loading="lazy"
                      src={form.image_url}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Registration / Join Link
                </label>
                <input
                  className="input"
                  placeholder="https://battlefy.com/your-tournament or Challonge link"
                  value={form.join_link}
                  onChange={(e) => set("join_link", e.target.value)}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Players will be sent here to register for your tournament
                </p>
              </div>

              {/* Summary preview */}
              <div className="rounded-xl border border-surface-border bg-navy/40 p-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  Pre-Match Briefing
                </p>
                {[
                  ["Tournament", form.name || "—"],
                  [
                    "Game",
                    games.find(
                      (g) => String(g.game_id) === String(form.game_id),
                    )?.game_name || "—",
                  ],
                  ["Organizer", form.organizer_name || "—"],
                  ["Location", form.location || "—"],
                  [
                    "Dates",
                    form.start_date
                      ? form.start_date + " → " + form.end_date
                      : "—",
                  ],
                  ["Prize Pool", fmtMoney(form.prize_pool) || "N/A"],
                  [
                    "Entry Fee",
                    Number(form.entry_fee) === 0
                      ? "Free"
                      : "$" + form.entry_fee,
                  ],
                  ["Format", FORMAT_LABELS[form.format] || form.format],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2 text-sm">
                    <span className="text-gray-500 w-24 shrink-0">{k}</span>
                    <span className="text-white font-medium truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &#8592; Back
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="btn-primary flex items-center gap-2"
              >
                Continue &#8594;
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sanctioning...
                  </>
                ) : (
                  <>
                    <span>&#127942;</span>Sanction Event
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rich Tournament Card ──────────────────────────────────────────────────────
function TournamentCard({ tournament, onDelete }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(tournament.tournament_id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDeleteCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const {
    tournament_id,
    name,
    game_name,
    prize_pool,
    entry_fee,
    region,
    format,
    start_date,
    status,
    registered_teams,
    image_url,
    organizer_name,
    location,
    description,
  } = tournament;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/tournament/${tournament_id}`;
    if (navigator.share) {
      navigator
        .share({ title: name, text: `Check out this tournament: ${name}`, url })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const startDateShort = fmt(start_date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const prizeStr = fmtMoney(prize_pool);

  return (
    <Link
      to={"/tournament/" + tournament_id}
      className="group flex flex-col rounded-2xl border border-surface-border overflow-hidden transition-all duration-300 hover:border-red/40 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
      style={ts.cardBg}
    >
      {/* Banner image or gradient placeholder */}
      <div className="relative h-36 overflow-hidden bg-navy shrink-0">
        {image_url ? (
          <img
          loading="lazy"
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.target.parentElement.classList.add("fallback-banner");
            }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg,rgba(255,70,85,0.18) 0%,rgba(15,23,42,0.9) 100%)",
            }}
          >
            <span className="text-5xl opacity-30">&#127942;</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, #1a2340 0%, transparent 60%)",
          }}
        />
        {/* Status badge + share + delete buttons top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={handleShare}
            title="Share tournament"
            className="flex items-center justify-center w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm hover:bg-red/30 border border-white/10 hover:border-red/40 text-gray-300 hover:text-white transition-all duration-200"
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            )}
          </button>
          {onDelete &&
            (confirmDelete ? (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Confirm delete"
                  className="flex items-center justify-center h-7 px-2 rounded-md bg-red/80 backdrop-blur-sm border border-red/60 text-white text-xs font-semibold hover:bg-red transition-all duration-200 disabled:opacity-50"
                >
                  {deleting ? "…" : "Delete?"}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  title="Cancel"
                  className="flex items-center justify-center w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm border border-white/10 text-gray-300 hover:text-white transition-all duration-200"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                title="Delete tournament"
                className="flex items-center justify-center w-7 h-7 rounded-md bg-black/40 backdrop-blur-sm hover:bg-red/30 border border-white/10 hover:border-red/40 text-gray-400 hover:text-red transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            ))}
          <StatusBadge status={status} />
        </div>
        {/* Prize pool badge */}
        {prizeStr && (
          <div className="absolute top-3 left-3 bg-red/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full border border-red/50">
            {prizeStr}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5 px-4 pb-4 flex-1">
        <div className="mt-1">
          <p className="text-xs text-gray-500">{game_name}</p>
          <h3 className="font-display font-bold text-white text-lg leading-tight mt-0.5 group-hover:text-red transition-colors line-clamp-2">
            {name}
          </h3>
        </div>

        {/* Organizer + location */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {organizer_name && (
            <span className="flex items-center gap-1">
              <span>&#128100;</span> {organizer_name}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <span>&#128205;</span> {location}
            </span>
          )}
        </div>

        {description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mt-auto pt-1">
          <div className="bg-navy/60 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Entry Fee</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {Number(entry_fee) === 0 ? "Free" : "$" + Number(entry_fee)}
            </p>
          </div>
          <div className="bg-navy/60 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Squads</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {registered_teams || 0}
            </p>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-border">
          <div className="flex gap-1.5 flex-wrap">
            {format && (
              <span className="badge-gray text-xs">
                {FORMAT_LABELS[format] || format}
              </span>
            )}
            {region && (
              <span className="badge-gray text-xs">&#127758; {region}</span>
            )}
          </div>
          <p className="text-xs text-gray-600">{startDateShort}</p>
        </div>
      </div>
    </Link>
  );
}

// ── Tournament Detail view ────────────────────────────────────────────────────
function TournamentDetail({ id }) {
  const { isAuthenticated } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTournamentById(id)
      .then((res) => setTournament(res.data.tournament))
      .catch(() => setError("Tournament not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!tournament)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <ErrorMessage message={error} />
      </div>
    );

  const t = tournament;
  const startFull = fmt(t.start_date, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const endFull = fmt(t.end_date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const prizeStr = fmtMoney(t.prize_pool);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title={t.name}
        description={`${t.name} — ${t.format ? t.format.replace(/_/g, " ") : "esports"} tournament on ArenaX. ${prizeStr ? `Prize pool: ${prizeStr}.` : ""} ${t.region ? `Region: ${t.region}.` : ""} Starts ${startFull}.`}
        path={`/tournament/${t.tournament_id}`}
        image={t.image_url || undefined}
      />
      <Link
        to="/tournament"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors group"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">
          &#8592;
        </span>{" "}
        Back to Tournaments
      </Link>

      {/* Banner */}
      {t.image_url && (
        <div className="rounded-2xl overflow-hidden mb-6 h-56 sm:h-72 relative border border-surface-border">
          <img
          loading="lazy"
            src={t.image_url}
            alt={t.name}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top,rgba(15,23,42,0.9) 0%,transparent 60%)",
            }}
          />
          <div className="absolute bottom-4 left-5">
            <StatusBadge status={t.status} />
          </div>
          {prizeStr && (
            <div className="absolute bottom-4 right-5 bg-red text-white text-sm font-bold px-3 py-1.5 rounded-full">
              {prizeStr} Prize Pool
            </div>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="card mb-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top right,rgba(255,70,85,0.12) 0%,transparent 60%)",
          }}
        />
        <div className="relative">
          {!t.image_url && (
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={t.status} />
            </div>
          )}
          <p className="text-gray-500 text-sm">{t.game_name}</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mt-1 leading-tight">
            {t.name}
          </h1>

          {/* Organizer info */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-gray-400">
            {t.organizer_name && (
              <span className="flex items-center gap-1.5">
                <span className="text-red">&#128100;</span>
                <span>
                  by <strong className="text-white">{t.organizer_name}</strong>
                </span>
              </span>
            )}
            {t.location && (
              <span className="flex items-center gap-1.5">
                <span className="text-red">&#128205;</span>
                <span>{t.location}</span>
              </span>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              {
                label: "Prize Pool",
                value: prizeStr || "N/A",
                highlight: !!prizeStr,
              },
              {
                label: "Entry Fee",
                value: Number(t.entry_fee) === 0 ? "Free" : "$" + t.entry_fee,
                highlight: false,
              },
              {
                label: "Region",
                value: t.region || "Global",
                highlight: false,
              },
              {
                label: "Format",
                value: FORMAT_LABELS[t.format] || t.format || "TBD",
                highlight: false,
              },
            ].map((s) => (
              <div key={s.label} className="bg-navy rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p
                  className={
                    "font-semibold mt-1 " +
                    (s.highlight ? "text-red" : "text-white")
                  }
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="mt-4 pt-4 border-t border-surface-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="text-gray-500">
              Starts: <span className="text-white ml-1">{startFull}</span>
            </span>
            {t.end_date && (
              <span className="text-gray-500">
                Ends: <span className="text-white ml-1">{endFull}</span>
              </span>
            )}
            {t.registration_deadline && (
              <span className="text-gray-500">
                Reg. Deadline:{" "}
                <span className="text-yellow-400 ml-1">
                  {fmt(t.registration_deadline, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {t.description && (
        <div className="card mb-6">
          <h2 className="font-display font-bold text-lg text-white mb-3">
            Mission Briefing
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
            {t.description}
          </p>
        </div>
      )}

      {/* Registration CTA — only for active tournaments */}
      {(t.status === "upcoming" || t.status === "ongoing") && (
        <div
          className="mb-6 rounded-2xl border border-red/25 px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.08) 0%,rgba(26,35,64,0.7) 100%)",
          }}
        >
          <div className="flex-1">
            <p className="font-semibold text-white">
              Ready to Enter the Gauntlet?
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {t.join_link
                ? "Registration is handled on the organizer's official page."
                : "The organizer hasn't added a registration link yet. Check back soon."}
            </p>
          </div>

          {/* Has join link + logged in → go register */}
          {t.join_link && isAuthenticated && (
            <a
              href={t.join_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <span>&#128279;</span> Register Now
            </a>
          )}

          {/* Has join link + guest → prompt login */}
          {t.join_link && !isAuthenticated && (
            <Link
              to="/login"
              className="btn-primary flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <span>&#128274;</span> Sign In to Register
            </Link>
          )}

          {/* No join link yet → disabled button */}
          {!t.join_link && (
            <button
              disabled
              className="btn-primary flex items-center gap-2 shrink-0 whitespace-nowrap opacity-40 cursor-not-allowed"
            >
              <span>&#128274;</span> Not Open Yet
            </button>
          )}
        </div>
      )}

      {/* Registered Teams */}
      {t.registered_teams?.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-bold text-lg text-white mb-3">
            Registered Teams{" "}
            <span className="text-gray-500 font-normal text-base">
              ({t.registered_teams.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {t.registered_teams.map((team) => (
              <span
                key={team.team_id}
                className="inline-flex items-center gap-1.5 bg-navy border border-surface-border text-gray-300 text-sm px-3 py-1.5 rounded-full"
              >
                &#128100; {team.team_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bracket */}
      {t.matches?.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-bold text-lg text-white mb-4">
            War Map
          </h2>
          <div className="flex flex-col gap-2">
            {t.matches.map((m) => (
              <div
                key={m.match_id}
                className="bg-navy rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              >
                <span
                  className={
                    "font-medium text-sm flex-1 text-right " +
                    (m.winner_team_id === m.team1_id
                      ? "text-white"
                      : "text-gray-500")
                  }
                >
                  {m.team1_name}
                </span>
                <span className="text-gray-600 text-xs font-mono bg-surface-card px-2 py-1 rounded">
                  {m.score || "vs"}
                </span>
                <span
                  className={
                    "font-medium text-sm flex-1 " +
                    (m.winner_team_id === m.team2_id
                      ? "text-white"
                      : "text-gray-500")
                  }
                >
                  {m.team2_name || "TBD"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tournament List ───────────────────────────────────────────────────────────
function TournamentList() {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const { isAuthenticated, user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "" });
  const [gameScope, setGameScope] = useState("all"); // "all" | "mine"
  const [myGameIds, setMyGameIds] = useState(null); // null = not loaded yet
  const [showForm, setShowForm] = useState(false);
  const [allGames, setAllGames] = useState([]);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    setLoading(true);
    getTournaments(filters)
      .then((res) => setTournaments(res.data.tournaments || []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [filters]);

  // Fetch the games the user has added to their profile, to power the
  // "My Games" filter option below.
  useEffect(() => {
    if (isAuthenticated) {
      getMyGames()
        .then((r) =>
          setMyGameIds(
            new Set((r.data.games || []).map((g) => String(g.game_id))),
          ),
        )
        .catch(() => setMyGameIds(new Set()));
    } else {
      setMyGameIds(new Set());
    }
  }, [isAuthenticated]);

  // Fetch all games for the form dropdown
  useEffect(() => {
    if (isAuthenticated) {
      import("../services/gameService")
        .then((m) => {
          m.getGames?.()
            ?.then((r) => setAllGames(r.data?.games || []))
            .catch(() => {});
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleCreated = (t) => {
    setTournaments((prev) => [{ ...t, registered_teams: 0 }, ...prev]);
    showToast("Tournament posted successfully!");
  };

  const handleDelete = async (id) => {
    try {
      await deleteTournament(id);
      setTournaments((prev) => prev.filter((t) => t.tournament_id !== id));
      showToast("Tournament deleted.");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete tournament.");
    }
  };

  const canDelete = (t) =>
    user && (String(t.created_by) === String(user.id) || user.isAdmin);

  // "My Games" scope filters the list down to tournaments for games the
  // user has added to their profile (client-side, since myGameIds can
  // represent multiple games at once).
  const visibleTournaments =
    gameScope === "mine" && myGameIds
      ? tournaments.filter((t) => myGameIds.has(String(t.game_id)))
      : tournaments;

  const featured =
    tournaments.find((t) => t.status === "ongoing") || tournaments[0];
  const rest = featured
    ? tournaments.filter((t) => t.tournament_id !== featured.tournament_id)
    : tournaments;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title="Esports Tournaments — Valorant, CS2 & FPS Tournaments"
        description="Join free esports tournaments on ArenaX — Valorant, CS2, League of Legends, Fortnite, Dota 2, and Apex Legends. Compete in online tournaments worldwide, win prizes, and track your rank."
        path="/tournament"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://arenax.io/" },
            { "@type": "ListItem", position: 2, name: "Tournaments", item: "https://arenax.io/tournament" },
          ],
        }}
      />
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          &#10003; {toast}
        </div>
      )}

      {/* Organizer modal */}
      {showForm && (
        <OrganizerPostModal
          games={allGames}
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Hero */}
      <div
        className="relative mb-10 rounded-2xl overflow-hidden border border-surface-border"
        style={{
          ...ts.heroBg,
        }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle,rgba(255,70,85,0.1) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%)",
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[220px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse,rgba(255,70,85,0.15) 0%,transparent 70%)",
          }}
        />

        <div className="relative z-10 px-8 py-12 sm:py-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-red/10 border border-red/20 rounded-full px-3 py-1 mb-4">
              <span className="live-dot" />
              <span className="text-xs text-red-light font-semibold tracking-wider uppercase">
                Proving Grounds
              </span>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight">
              Compete on the <span className="text-gradient">World Stage</span>
            </h1>
            <p className="text-gray-400 mt-3 max-w-lg text-sm leading-relaxed">
              Browse open brackets, register your squad, and track live results.
              Organizers can forge and manage their own events.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {isAuthenticated ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <span>&#127942;</span> Forge a Tournament
                </button>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary flex items-center gap-2"
                >
                  <span>&#128279;</span> Sign In to Forge
                </Link>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 self-center">
                <span>&#9889;</span> Live brackets &amp; team registration
              </div>
            </div>
          </div>
          <div className="flex sm:flex-col gap-3 shrink-0">
            {[
              ["🏆", "Tournaments"],
              ["👥", "Teams Registered"],
              ["🎉", "Prize Pools"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5"
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <select
          className="input w-44"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
        >
          <option value="">All Statuses</option>
          <option value="upcoming">Incoming</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>
        {isAuthenticated && (
          <select
            className="input w-40"
            value={gameScope}
            onChange={(e) => setGameScope(e.target.value)}
          >
            <option value="all">All Games</option>
            <option value="mine">My Games</option>
          </select>
        )}
        {(filters.status || gameScope !== "all") && (
          <button
            onClick={() => {
              setFilters({ status: "" });
              setGameScope("all");
            }}
            className="btn-ghost text-sm text-red-light"
          >
            &#10005; Clear
          </button>
        )}
        {visibleTournaments.length > 0 && (
          <span className="text-sm text-gray-500 ml-auto">
            <span className="text-white font-semibold">
              {visibleTournaments.length}
            </span>{" "}
            event{visibleTournaments.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-surface-border border-t-red rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading tournaments...</p>
        </div>
      ) : visibleTournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-20">&#127942;</div>
          <p className="text-gray-300 font-medium text-xl font-display">
            No tournaments found
          </p>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            {gameScope === "mine"
              ? "No tournaments for your games right now — try All Games"
              : "Try adjusting filters, or be the first to post one!"}
          </p>
          {isAuthenticated && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-6 flex items-center gap-2"
            >
              <span>&#127942;</span> Forge a Tournament
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleTournaments.map((t) => (
            <TournamentCard
              key={t.tournament_id}
              tournament={t}
              onDelete={canDelete(t) ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Tournament() {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const { id } = useParams();
  return id ? <TournamentDetail id={id} /> : <TournamentList />;
}
