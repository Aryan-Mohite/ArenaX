import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getFollowers, getFollowing } from "../services/userService";

function Avatar({ user }) {
  if (user?.profile_picture)
    return (
      <img
          loading="lazy"
        src={user.profile_picture}
        alt={user.username}
        className="w-10 h-10 rounded-full object-cover border-2 border-red/30 shrink-0"
      />
    );
  return (
    <div className="w-10 h-10 rounded-full bg-red/20 border-2 border-red/30 flex items-center justify-center font-bold text-sm shrink-0 text-red-400">
      {user?.username?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

export default function FollowStatsModal({ type, userId, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const title = type === "followers" ? "Followers" : "Following";

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    const fetch = type === "followers" ? getFollowers : getFollowing;
    fetch(userId)
      .then((res) => setUsers(res.data.users || []))
      .catch(() => setError("Could not load list."))
      .finally(() => setLoading(false));
  }, [type, userId]);

  const handleUserClick = (user) => {
    onClose();
    navigate(`/players/${user.user_id}`);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,6,23,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up flex flex-col"
        style={{
          background: "linear-gradient(145deg,#1a2340,#0f172a)",
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.15), 0 32px 80px rgba(0,0,0,0.75)",
          maxHeight: "75vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <h2 className="font-display font-bold text-white text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-3 py-3">
          {loading ? (
            <div className="flex flex-col gap-3 py-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-2 py-2 animate-pulse"
                >
                  <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded w-28" />
                    <div className="h-2.5 bg-white/5 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-gray-500 text-sm py-8">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              {type === "followers"
                ? "No followers yet."
                : "Not following anyone yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {users.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => handleUserClick(u)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left w-full"
                >
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {u.username}
                    </p>
                    {(u.country || u.region) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[u.region, u.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
