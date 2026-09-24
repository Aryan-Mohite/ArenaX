import { useState, useEffect } from "react";
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getFollowStatus,
} from "../services/userService";
import { useAuth } from "../context/AuthContext";

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 20 }) {
  const s = `w-${size} h-${size}`;
  if (user?.profile_picture)
    return (
      <img
          loading="lazy"
        src={user.profile_picture}
        alt={user.username}
        className={`${s} rounded-full object-cover border-2 border-red/30 shrink-0`}
      />
    );
  return (
    <div
      className={`${s} rounded-full bg-red/20 border-2 border-red/30 flex items-center justify-center font-bold shrink-0`}
      style={{ fontSize: size >= 16 ? "1.75rem" : "0.85rem", color: "#ff4655" }}
    >
      {user?.username?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-xl border border-surface-border bg-navy/60">
      <span className="text-xl font-bold text-white tabular-nums">
        {value ?? "—"}
      </span>
      <span className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function PlayerProfileModal({ userId, onClose }) {
  const { isAuthenticated, user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [followStatus, setFollowStatus] = useState({
    following: false,
    followers: 0,
    following_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState("");

  const isSelf = currentUser?.id && String(currentUser.id) === String(userId);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");

    const fetches = [getUserProfile(userId)];
    if (isAuthenticated && !isSelf) fetches.push(getFollowStatus(userId));

    Promise.all(fetches)
      .then(([profileRes, statusRes]) => {
        setProfile(profileRes.data.profile);
        if (statusRes) {
          setFollowStatus({
            following: statusRes.data.following,
            followers: Number(statusRes.data.followers),
            following_count: Number(statusRes.data.following_count),
          });
        } else {
          // For self or unauthenticated: just show counts from profile if available
          setFollowStatus({
            following: false,
            followers: 0,
            following_count: 0,
          });
        }
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [userId, isAuthenticated, isSelf]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated || followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus.following) {
        await unfollowUser(userId);
        setFollowStatus((s) => ({
          ...s,
          following: false,
          followers: Math.max(0, s.followers - 1),
        }));
      } else {
        await followUser(userId);
        setFollowStatus((s) => ({
          ...s,
          following: true,
          followers: s.followers + 1,
        }));
      }
    } catch (err) {
      const status = err?.response?.status;
      console.error("[Follow toggle error]", status, err?.response?.data);
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,6,23,0.82)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={{
          background: "linear-gradient(145deg,#1a2340,#0f172a)",
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.15), 0 32px 80px rgba(0,0,0,0.75)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header gradient strip ── */}
        <div
          className="h-24 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,70,85,0.25) 0%, rgba(139,92,246,0.15) 50%, rgba(26,35,64,1) 100%)",
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            ✕
          </button>
          {/* Decorative dot pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,70,85,0.4) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        {/* ── Avatar (overlapping) ── */}
        <div className="px-6 pb-0 -mt-12 relative z-10">
          {loading ? (
            <div className="w-20 h-20 rounded-full bg-surface-card border-2 border-red/20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-surface-border border-t-red rounded-full animate-spin" />
            </div>
          ) : (
            <Avatar user={profile} size={20} />
          )}
        </div>

        {/* ── Content ── */}
        <div className="px-6 pt-3 pb-6">
          {error ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3 opacity-30">😕</span>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          ) : loading ? (
            <div className="space-y-3 mt-2">
              <div className="h-5 bg-white/5 rounded-lg w-36 animate-pulse" />
              <div className="h-3 bg-white/5 rounded w-24 animate-pulse" />
              <div className="h-10 bg-white/5 rounded-xl animate-pulse mt-4" />
            </div>
          ) : profile ? (
            <>
              {/* Name row */}
              <div className="flex items-start justify-between gap-3 mt-1">
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-white text-xl leading-tight truncate">
                    {profile.username}
                  </h2>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {profile.country && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        🌍 {profile.country}
                      </span>
                    )}
                    {profile.region && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        📍 {profile.region}
                      </span>
                    )}
                  </div>
                </div>

                {/* Follow button */}
                {isAuthenticated && !isSelf && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-60"
                    style={
                      followStatus.following
                        ? {
                            background: "rgba(255,70,85,0.1)",
                            border: "1px solid rgba(255,70,85,0.3)",
                            color: "#ff4655",
                          }
                        : {
                            background:
                              "linear-gradient(135deg,#ff4655,#c8313e)",
                            border: "1px solid rgba(255,70,85,0.5)",
                            color: "#fff",
                          }
                    }
                  >
                    {followLoading ? (
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : followStatus.following ? (
                      <>✓ Following</>
                    ) : (
                      <>+ Follow</>
                    )}
                  </button>
                )}

                {isSelf && (
                  <a
                    href="/profile"
                    className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border border-surface-border text-gray-400 hover:text-white hover:border-red/30 transition-colors"
                  >
                    ✏️ Edit Profile
                  </a>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-sm text-gray-400 mt-3 leading-relaxed line-clamp-3">
                  {profile.bio}
                </p>
              )}

              {/* Stats row */}
              <div className="flex gap-3 mt-4">
                <StatPill
                  label="Followers"
                  value={followStatus.followers.toLocaleString()}
                />
                <StatPill
                  label="Games"
                  value={profile.game_profiles?.length ?? 0}
                />
                <StatPill
                  label="Achievements"
                  value={profile.achievements?.length ?? 0}
                />
              </div>

              {/* Game profiles */}
              {profile.game_profiles?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2.5">
                    Game Profiles
                  </p>
                  <div className="flex flex-col gap-2">
                    {profile.game_profiles.slice(0, 4).map((gp, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-surface-border bg-navy/40"
                      >
                        {gp.icon ? (
                          <img
          loading="lazy"
                            src={gp.icon}
                            alt={gp.game_name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-red/20 border border-red/30 flex items-center justify-center text-red text-xs font-bold">
                            🎮
                          </div>
                        )}
                        <span className="text-sm font-medium text-white flex-1 truncate">
                          {gp.game_name}
                        </span>
                        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                          {gp.rank && (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                              {gp.rank}
                            </span>
                          )}
                          {gp.role && (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">
                              {gp.role}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {profile.game_profiles.length > 4 && (
                      <p className="text-xs text-gray-600 text-center">
                        +{profile.game_profiles.length - 4} more games
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Achievements */}
              {profile.achievements?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2.5">
                    Recent Achievements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.achievements.map((ach, i) => (
                      <div
                        key={i}
                        title={ach.description}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-border bg-navy/40 cursor-default"
                      >
                        <span className="text-base">{ach.icon || "🏅"}</span>
                        <span className="text-xs text-gray-300 font-medium">
                          {ach.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Member since */}
              <p className="text-xs text-gray-600 mt-5 text-center">
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
