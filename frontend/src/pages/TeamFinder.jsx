import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPosts,
  createPost,
  applyToPost,
} from "../services/teamFinderService";
import { getMyGames } from "../services/gameService";
import { ErrorMessage } from "../components/UI";
import { useAuth } from "../context/AuthContext";

// ─── Lightweight fetch helper (uses same token as your axios services) ─────────
const authFetch = async (url, options = {}) => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const res = await fetch(`/api${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
};

const deadlineLabel = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "Expired", color: "#ef4444" };
  const h = Math.floor(diff / 3600000);
  if (h < 24) return { text: `${h}h left`, color: "#f59e0b" };
  const d = Math.floor(h / 24);
  return { text: `${d}d left`, color: "#10b981" };
};

// ─── GridBackground ───────────────────────────────────────────────────────────
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle,rgba(255,70,85,0.12) 1px,transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%,black 40%,transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "300px",
          background:
            "radial-gradient(ellipse,rgba(255,70,85,0.18) 0%,transparent 70%)",
        }}
      />
    </div>
  );
}

// ─── PushRequestModal ─────────────────────────────────────────────────────────
function PushRequestModal({ post, onClose, onSubmit }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onSubmit(post.post_id, msg || "I would like to join your team!");
    setLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.75)" }}
    >
      <div
        className="animate-slide-up w-full max-w-md rounded-2xl border border-surface-border bg-surface-card"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-t-2xl px-6 pt-6 pb-4"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.12) 0%,transparent 60%)",
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold">
              {post.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">
                Sending Request To
              </p>
              <p className="font-display font-bold text-white text-lg">
                {post.username}
              </p>
            </div>
          </div>
        </div>
        <div className="mx-6 mb-5 rounded-xl bg-navy/60 border border-surface-border px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-white">
            {post.game_name}
          </span>
          {post.role_required && (
            <span className="badge-red text-xs">{post.role_required}</span>
          )}
          {post.rank_required && (
            <span className="badge-blue text-xs">{post.rank_required}</span>
          )}
          {post.region && (
            <span className="badge-gray text-xs">{post.region}</span>
          )}
        </div>
        <div className="px-6 pb-6">
          <label className="block text-sm text-gray-400 mb-2">
            Message <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Introduce yourself — your role, rank, playstyle..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <div className="flex gap-3 mt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handle}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>🚀 Push Request</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ApplicantsModal ──────────────────────────────────────────────────────────
function ApplicantsModal({ post, onClose, onChat, onAccept, onReject }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/teamfinder/${post.post_id}/applications`)
      .then((r) => setApps(r.applications || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [post.post_id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.82)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={{
          background: "linear-gradient(145deg,#1a2340,#131a2e)",
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-surface-border"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.08) 0%,transparent 60%)",
          }}
        >
          <div>
            <h3 className="font-display font-bold text-white text-lg">
              Applicants
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {post.game_name} · {post.role_required || "Any Role"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-surface-border border-t-red rounded-full animate-spin" />
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-3 opacity-20">📭</div>
              <p className="text-gray-400 font-medium">No applicants yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Share your listing to attract players
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {apps.map((app) => (
                <div
                  key={app.application_id}
                  className="px-6 py-4 hover:bg-white/2 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm shrink-0">
                      {app.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">
                          {app.username}
                        </span>
                        {app.rank && (
                          <span className="badge-blue text-xs">{app.rank}</span>
                        )}
                        {app.elo_rating && (
                          <span className="badge-gray text-xs">
                            ELO {app.elo_rating}
                          </span>
                        )}
                        {/* Accepted badge */}
                        {app.status === "accepted" && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 font-medium">
                            ✓ Accepted
                          </span>
                        )}
                        {app.status === "rejected" && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light font-medium">
                            ✕ Rejected
                          </span>
                        )}
                      </div>
                      {app.message && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {app.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        {timeAgo(app.applied_at)}
                      </p>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3 ml-12">
                    {app.status !== "accepted" && (
                      <button
                        onClick={() => onAccept(app, setApps)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        ✓ Accept
                      </button>
                    )}
                    {app.status !== "rejected" && (
                      <button
                        onClick={() => onReject(app, setApps)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-red/30 bg-red/10 text-red-light hover:bg-red/20 transition-colors"
                      >
                        ✕ Reject
                      </button>
                    )}
                    {app.status === "accepted" && (
                      <button
                        onClick={() => onChat(app.user_id, app.username)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1"
                      >
                        💬 Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ChatModal ────────────────────────────────────────────────────────────────
function ChatModal({ partnerId, partnerName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const r = await authFetch(`/messages/conversation/${partnerId}?limit=60`);
      setMessages(r.messages || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 4000); // poll every 4s
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const optimistic = {
      message_id: Date.now(),
      sender_id: user?.id,
      receiver_id: partnerId,
      content: text.trim(),
      sent_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    try {
      await authFetch("/messages", {
        method: "POST",
        body: { receiver_id: partnerId, content: optimistic.content },
      });
    } catch {
      /* silent */
    }
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.82)" }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-surface-border overflow-hidden flex flex-col animate-slide-up"
        style={{
          height: "min(90vh, 580px)",
          background: "linear-gradient(145deg,#1a2340,#0f172a)",
          boxShadow:
            "0 0 0 1px rgba(59,130,246,0.2),0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-surface-border shrink-0"
          style={{
            background:
              "linear-gradient(135deg,rgba(59,130,246,0.08) 0%,transparent 60%)",
          }}
        >
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
            {partnerName?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">{partnerName}</p>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Team Chat
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="w-6 h-6 border-2 border-surface-border border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <div className="text-4xl mb-2 opacity-20">💬</div>
              <p className="text-gray-500 text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.message_id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${
                      isMine
                        ? "rounded-br-sm bg-blue-500/20 border border-blue-500/20 text-white"
                        : "rounded-bl-sm bg-white/5 border border-white/10 text-gray-200"
                    } ${msg._optimistic ? "opacity-60" : ""}`}
                  >
                    <p>{msg.content}</p>
                    <p
                      className={`text-xs mt-0.5 ${isMine ? "text-blue-400/60" : "text-gray-600"}`}
                    >
                      {new Date(msg.sent_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-surface-border shrink-0 flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-xl border border-surface-border bg-white/5 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            rows={1}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            style={{ minHeight: "38px", maxHeight: "96px" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all shrink-0 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ post, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onConfirm(post.post_id);
    setLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.82)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-red/20 overflow-hidden animate-slide-up"
        style={{
          background: "linear-gradient(145deg,#1a2340,#131a2e)",
          boxShadow:
            "0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red/10 border border-red/20 flex items-center justify-center text-3xl mx-auto mb-4">
            🗑️
          </div>
          <h3 className="font-display font-bold text-white text-lg">
            Delete Listing?
          </h3>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            This will permanently close your listing for{" "}
            <span className="text-white font-medium">{post.game_name}</span>.
            All pending applications will be removed.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red/30 bg-red/20 text-red-light hover:bg-red/30 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-red/30 border-t-red rounded-full animate-spin" />
            ) : (
              "🗑️ Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EnhancedCard ─────────────────────────────────────────────────────────────
function EnhancedCard({
  post,
  onPushRequest,
  alreadyApplied,
  isAuthenticated,
  currentUserId,
  onViewApplicants,
  onDelete,
  onViewProfile,
}) {
  const {
    username,
    game_name,
    rank_required,
    role_required,
    region,
    description,
    poster_rank,
    poster_elo,
    created_at,
    post_id,
    deadline,
  } = post;

  const accentMap = ["#ff4655", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
  const accent = accentMap[(post_id || 0) % accentMap.length];
  const isOwner = currentUserId && post.user_id === currentUserId;
  const dl = deadlineLabel(deadline);

  return (
    <div
      className="relative flex flex-col gap-3 rounded-xl border border-surface-border overflow-hidden transition-all duration-300 hover:border-red/40 hover:-translate-y-0.5"
      style={{ background: "linear-gradient(145deg,#1a2340,#131a2e)" }}
    >
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg,${accent},transparent)` }}
      />
      <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {/* User row */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => onViewProfile && onViewProfile(post.user_id)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-transform hover:scale-110 hover:ring-2 ring-red/40 focus:outline-none"
            style={{
              background: accent + "22",
              border: "1px solid " + accent + "44",
              color: accent,
            }}
            title={`View ${username}'s profile`}
          >
            {username?.[0]?.toUpperCase()}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">
              {username}
            </p>
            <p className="text-xs text-gray-500 truncate">{game_name}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dl && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: dl.color,
                  background: dl.color + "18",
                  border: `1px solid ${dl.color}33`,
                }}
              >
                ⏱ {dl.text}
              </span>
            )}
            <span className="text-xs text-gray-600">{timeAgo(created_at)}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {role_required && <span className="badge-red">{role_required}</span>}
          {rank_required && <span className="badge-blue">{rank_required}</span>}
          {region && <span className="badge-gray">📍 {region}</span>}
          {poster_elo && <span className="badge-gray">ELO {poster_elo}</span>}
          {poster_rank && <span className="badge-gray">🏅 {poster_rank}</span>}
        </div>

        {description && (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 flex-1">
            {description}
          </p>
        )}

        {/* Owner controls */}
        {isOwner && (
          <div className="mt-auto flex gap-2">
            <button
              onClick={() => onViewApplicants(post)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              👥 Applicants
            </button>
            <button
              onClick={() => onDelete(post)}
              className="w-9 flex items-center justify-center py-2 rounded-lg border border-red/20 bg-red/5 text-red-light hover:bg-red/15 transition-colors text-sm"
            >
              🗑️
            </button>
          </div>
        )}

        {/* Apply button for non-owners */}
        {isAuthenticated &&
          !isOwner &&
          (alreadyApplied ? (
            <div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 text-sm font-medium">
              <span>✓</span> Request Sent
            </div>
          ) : (
            <button
              onClick={onPushRequest}
              className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{
                background: `linear-gradient(135deg,${accent}22,${accent}10)`,
                border: `1px solid ${accent}33`,
                color: accent,
              }}
            >
              🚀 Push Request
            </button>
          ))}

        {!isAuthenticated && (
          <a
            href="/login"
            className="mt-auto text-center block w-full py-2.5 rounded-lg border border-surface-border text-gray-500 text-sm hover:border-red/30 hover:text-gray-300 transition-colors"
          >
            Login to Apply
          </a>
        )}
      </div>
    </div>
  );
}

// ─── MyApplicationsPanel — shown to the applicant (B) ────────────────────────
function MyApplicationsPanel({ onChat }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await authFetch("/teamfinder/my-applications");
      setApps(r.applications || []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 8 s so B sees status changes without refreshing
  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  if (!loading && apps.length === 0) return null;

  const statusConfig = {
    pending: {
      label: "⏳ Pending",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.25)",
      color: "#f59e0b",
    },
    accepted: {
      label: "✓ Accepted",
      bg: "rgba(16,185,129,0.1)",
      border: "rgba(16,185,129,0.25)",
      color: "#10b981",
    },
    rejected: {
      label: "✕ Rejected",
      bg: "rgba(255,70,85,0.1)",
      border: "rgba(255,70,85,0.25)",
      color: "#ff4655",
    },
  };

  return (
    <div
      className="mb-8 rounded-2xl border border-surface-border overflow-hidden"
      style={{ background: "linear-gradient(145deg,#1a2340,#131a2e)" }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm">
            📨
          </div>
          <div className="text-left">
            <p className="font-semibold text-white text-sm">My Applications</p>
            <p className="text-xs text-gray-500">
              Track your team join requests
            </p>
          </div>
          {/* Unread accepted badge */}
          {apps.some((a) => a.status === "accepted") && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 border border-green-500/30 text-green-400">
              {apps.filter((a) => a.status === "accepted").length} Accepted
            </span>
          )}
        </div>
        <span
          className={`text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-surface-border">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-surface-border border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {apps.map((app) => {
                const cfg = statusConfig[app.status] || statusConfig.pending;
                return (
                  <div
                    key={app.application_id}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-white/2 transition-colors"
                  >
                    {/* Post owner avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{
                        background: "rgba(255,70,85,0.15)",
                        border: "1px solid rgba(255,70,85,0.3)",
                        color: "#ff4655",
                      }}
                    >
                      {app.poster_username?.[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">
                          {app.poster_username}
                        </span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-400">
                          {app.game_name}
                        </span>
                        {app.role_required && (
                          <span className="badge-red text-xs">
                            {app.role_required}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {timeAgo(app.applied_at)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                      style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        color: cfg.color,
                      }}
                    >
                      {cfg.label}
                    </span>

                    {/* Chat button — only when accepted */}
                    {app.status === "accepted" && (
                      <button
                        onClick={() =>
                          onChat(app.poster_user_id, app.poster_username)
                        }
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: "rgba(59,130,246,0.15)",
                          border: "1px solid rgba(59,130,246,0.3)",
                          color: "#60a5fa",
                        }}
                      >
                        💬 Chat
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TeamFinder() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ game_id: "", region: "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [requestPost, setRequestPost] = useState(null);
  const [appliedIds, setAppliedIds] = useState(new Set());

  // New state for new features
  const [applicantsPost, setApplicantsPost] = useState(null);
  const [chatPartner, setChatPartner] = useState(null); // { userId, username }
  const [deletePost, setDeletePost] = useState(null);

  const [form, setForm] = useState({
    game_id: "",
    rank_required: "",
    role_required: "",
    region: "",
    description: "",
    deadline: "",
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.game_id) params.game_id = filters.game_id;
      if (filters.region) params.region = filters.region;
      const res = await getPosts(params);
      setPosts(res.data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);
  useEffect(() => {
    if (isAuthenticated) {
      getMyGames()
        .then((r) => setMyGames(r.data.games || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handlePushRequest = async (postId, message) => {
    try {
      await applyToPost(postId, { message });
      setAppliedIds((prev) => new Set([...prev, postId]));
      showToast("Request sent! The team leader will review it.", "success");
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to send request",
        "error",
      );
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = { ...form };
      if (!payload.deadline) delete payload.deadline;
      await createPost(payload);
      setShowForm(false);
      setForm({
        game_id: "",
        rank_required: "",
        role_required: "",
        region: "",
        description: "",
        deadline: "",
      });
      showToast("Listing published!", "success");
      loadPosts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create post");
    }
  };

  // Accept applicant → update status via API
  const handleAccept = async (app, setApps) => {
    try {
      await authFetch(
        `/teamfinder/${app.post_id}/applications/${app.application_id}/accept`,
        { method: "PATCH" },
      );
      setApps((prev) =>
        prev.map((a) =>
          a.application_id === app.application_id
            ? { ...a, status: "accepted" }
            : a,
        ),
      );
      showToast(`${app.username} accepted! You can now chat.`, "success");
    } catch {
      showToast("Failed to accept applicant", "error");
    }
  };

  // Reject applicant
  const handleReject = async (app, setApps) => {
    try {
      await authFetch(
        `/teamfinder/${app.post_id}/applications/${app.application_id}/reject`,
        { method: "PATCH" },
      );
      setApps((prev) =>
        prev.map((a) =>
          a.application_id === app.application_id
            ? { ...a, status: "rejected" }
            : a,
        ),
      );
      showToast("Applicant rejected", "success");
    } catch {
      showToast("Failed to reject applicant", "error");
    }
  };

  // Delete / close post
  const handleDelete = async (postId) => {
    try {
      await authFetch(`/teamfinder/${postId}/close`, { method: "PATCH" });
      setPosts((prev) => prev.filter((p) => p.post_id !== postId));
      showToast("Listing deleted", "success");
    } catch {
      showToast("Failed to delete listing", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {/* Toast */}
      {toast.msg && (
        <div
          className={
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in border " +
            (toast.type === "error"
              ? "bg-red/20 border-red/40 text-red-light"
              : "bg-surface-card border-green-500/30 text-green-400")
          }
        >
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {requestPost && (
        <PushRequestModal
          post={requestPost}
          onClose={() => setRequestPost(null)}
          onSubmit={handlePushRequest}
        />
      )}
      {applicantsPost && (
        <ApplicantsModal
          post={applicantsPost}
          onClose={() => setApplicantsPost(null)}
          onChat={(userId, username) => {
            setApplicantsPost(null);
            setChatPartner({ userId, username });
          }}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
      {chatPartner && (
        <ChatModal
          partnerId={chatPartner.userId}
          partnerName={chatPartner.username}
          onClose={() => setChatPartner(null)}
        />
      )}
      {deletePost && (
        <DeleteConfirmModal
          post={deletePost}
          onClose={() => setDeletePost(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Hero */}
      <div
        className="relative mb-10 rounded-2xl overflow-hidden border border-surface-border"
        style={{
          background:
            "linear-gradient(135deg,#0f172a 0%,#1a2340 50%,#130a1a 100%)",
        }}
      >
        <GridBackground />
        <div className="relative z-10 px-8 py-12 sm:py-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-red/10 border border-red/20 rounded-full px-3 py-1 mb-4">
              <span className="live-dot" />
              <span className="text-xs text-red-light font-semibold tracking-wider uppercase">
                Player Recruitment
              </span>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight">
              Find Your <span className="text-gradient">Perfect Squad</span>
            </h1>
            <p className="text-gray-400 mt-3 max-w-lg text-sm leading-relaxed">
              Push join requests, post recruitment listings, and build your
              dream team. Filter by game, rank, role, and region.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {isAuthenticated ? (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="btn-primary flex items-center gap-2"
                >
                  <span>📋</span> Post a Listing
                </button>
              ) : (
                <a href="/login" className="btn-primary">
                  Login to Post
                </a>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 self-center">
                <span>🎯</span> Push requests to any open listing
              </div>
            </div>
          </div>
          <div className="flex sm:flex-col gap-3 shrink-0">
            {[
              ["⚔️", "Active Listings"],
              ["🤝", "Push Requests"],
              ["🏆", "Teams Formed"],
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

      {/* Create form */}
      {showForm && (
        <div
          className="mb-8 rounded-2xl border border-red/20 overflow-hidden animate-slide-up"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.06) 0%,rgba(26,35,64,0.9) 50%)",
          }}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-surface-border">
            <div>
              <h3 className="font-display font-bold text-xl text-white">
                Create a Listing
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Fill in the details to find your ideal teammate
              </p>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-6">
            <ErrorMessage message={error} />
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Game <span className="text-red">*</span>
                </label>
                <select
                  className="input"
                  value={form.game_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, game_id: e.target.value }))
                  }
                  required
                >
                  <option value="">Select game</option>
                  {myGames.map((g) => (
                    <option key={g.game_id} value={g.game_id}>
                      {g.game_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Region
                </label>
                <input
                  className="input"
                  placeholder="e.g. South Asia, NA-East"
                  value={form.region}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, region: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Role Required
                </label>
                <input
                  className="input"
                  placeholder="e.g. IGL, Support, Entry Fragger"
                  value={form.role_required}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role_required: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Rank Required
                </label>
                <input
                  className="input"
                  placeholder="e.g. Diamond+, Plat-Gold"
                  value={form.rank_required}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rank_required: e.target.value }))
                  }
                />
              </div>
              {/* Deadline field — NEW */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Deadline <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.deadline}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deadline: e.target.value }))
                  }
                />
                <p className="text-xs text-gray-600 mt-1">
                  Listing will show a countdown and auto-expire at this time
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Tell players about your team, requirements, schedule..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                >
                  <span>📋</span> Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* My Applications — visible to applicants (B) */}
      {isAuthenticated && (
        <MyApplicationsPanel
          onChat={(userId, username) => setChatPartner({ userId, username })}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            🔍
          </span>
          <input
            className="input pl-9 w-52"
            placeholder="Filter by region..."
            value={filters.region}
            onChange={(e) =>
              setFilters((f) => ({ ...f, region: e.target.value }))
            }
          />
        </div>
        {myGames.length > 0 && (
          <select
            className="input w-48"
            value={filters.game_id}
            onChange={(e) =>
              setFilters((f) => ({ ...f, game_id: e.target.value }))
            }
          >
            <option value="">All Games</option>
            {myGames.map((g) => (
              <option key={g.game_id} value={g.game_id}>
                {g.game_name}
              </option>
            ))}
          </select>
        )}
        {(filters.region || filters.game_id) && (
          <button
            onClick={() => setFilters({ game_id: "", region: "" })}
            className="btn-ghost text-sm text-red-light"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-surface-border border-t-red rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Searching for squads...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-20">🎯</div>
          <p className="text-gray-300 font-medium text-xl font-display">
            No listings found
          </p>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            {filters.region || filters.game_id
              ? "Try removing filters to see all listings"
              : "Be the first to post a team finder listing"}
          </p>
          {isAuthenticated && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-6"
            >
              Post a Listing
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              <span className="text-white font-semibold">{posts.length}</span>{" "}
              listing{posts.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <EnhancedCard
                key={post.post_id}
                post={post}
                onPushRequest={() => setRequestPost(post)}
                alreadyApplied={appliedIds.has(post.post_id)}
                isAuthenticated={isAuthenticated}
                currentUserId={user?.id}
                onViewApplicants={setApplicantsPost}
                onDelete={setDeletePost}
                onViewProfile={(uid) => navigate(`/users/${uid}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
