import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";

const STATUS_STYLES = {
  upcoming: "badge-blue",
  ongoing: "badge-green",
  completed: "badge-gray",
  cancelled: "badge-red",
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

export default function TournamentCard({ tournament }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";
  const [copied, setCopied] = useState(false);

  const {
    tournament_id,
    name,
    game_name,
    game_icon,
    prize_pool,
    entry_fee,
    region,
    format,
    start_date,
    status,
    registered_teams,
  } = tournament;

  const statusClass = STATUS_STYLES[status] || "badge-gray";
  const startDate = start_date
    ? new Date(start_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/tournament/${tournament_id}`;
    const shareData = {
      title: name,
      text: `Check out this tournament: ${name}`,
      url,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <Link
      to={`/tournament/${tournament_id}`}
      className="card-hover flex flex-col gap-3 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-white text-lg leading-tight group-hover:text-red transition-colors truncate">
            {name}
          </h3>
          <p className="text-gray-400 text-sm mt-0.5">{game_name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={statusClass}>{status}</span>
          <button
            onClick={handleShare}
            title="Share tournament"
            className="flex items-center justify-center w-7 h-7 rounded-md bg-white/5 hover:bg-red/20 border border-white/10 hover:border-red/40 text-gray-400 hover:text-red transition-all duration-200"
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
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        {prize_pool > 0 && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Prize Pool</p>
            <p className="text-sm font-semibold text-red">
              ${Number(prize_pool).toLocaleString()}
            </p>
          </div>
        )}
        {region && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Region</p>
            <p className="text-sm font-medium text-gray-300">{region}</p>
          </div>
        )}
        {entry_fee >= 0 && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Entry</p>
            <p className="text-sm font-medium text-gray-300">
              {Number(entry_fee) === 0 ? "Free" : `$${Number(entry_fee)}`}
            </p>
          </div>
        )}
        {registered_teams !== undefined && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Teams</p>
            <p className="text-sm font-medium text-gray-300">
              {registered_teams}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 divider">
        <div className="flex items-center gap-2 mt-2">
          {format && (
            <span className="badge-gray">
              {FORMAT_LABELS[format] || format}
            </span>
          )}
        </div>
        {startDate && <p className="text-xs text-gray-500 mt-2">{startDate}</p>}
      </div>
    </Link>
  );
}
