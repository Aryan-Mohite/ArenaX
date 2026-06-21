import { useState } from "react";

// Small pill that shows a team's unique ID and copies it to the clipboard on click.
// Used anywhere a team is displayed (My Teams, My Dispatches, Team Finder cards,
// Profile teams section, etc.) so a team's ID is always easy to find and share.
export default function TeamIdBadge({ teamId, className = "" }) {
  const [copied, setCopied] = useState(false);

  if (teamId === undefined || teamId === null || teamId === "") return null;

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard
      ?.writeText(String(teamId))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy Team ID"
      className={`badge-gray font-mono !text-[11px] hover:border-white/30 hover:text-white transition-colors cursor-pointer ${className}`}
    >
      {copied ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3 text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          ID: {teamId}
        </>
      )}
    </button>
  );
}
