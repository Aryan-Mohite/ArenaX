import { useEffect, useState } from "react";
import { getLiveStreams, goLive, endStream } from "../services/streamService";
import { getMyGames } from "../services/gameService";
import { PageLoader, EmptyState, ErrorMessage } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import API from "../api/api";
import SEO from "../components/SEO";
import { buildEmbedSrc, PLATFORM_LABEL } from "../utils/streamEmbed";

function StreamCard({ stream, onWatch }) {
  const canEmbed = !!stream.embed;
  const Wrapper = canEmbed ? "button" : "a";
  const wrapperProps = canEmbed
    ? { type: "button", onClick: () => onWatch(stream) }
    : { href: stream.stream_url || "#", target: "_blank", rel: "noreferrer" };
  return (
    <Wrapper
      {...wrapperProps}
      className="card-hover flex flex-col gap-3 group text-left w-full"
    >
      {/* Thumbnail placeholder */}
      <div className="h-32 -mx-5 -mt-5 mb-2 bg-navy rounded-t-xl flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red/10 to-navy" />
        <div className="relative text-4xl opacity-20">🎮</div>
        <span className="absolute top-2 left-2 badge-red text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-red-light inline-block mr-1 animate-pulse" />
          LIVE
        </span>
        <span className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black/60 px-2 py-0.5 rounded">
          {stream.viewer_count?.toLocaleString() || 0} viewers
        </span>
        <span className="absolute top-2 right-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded">
          {canEmbed ? "▶ Watch here" : "↗ Opens " + (PLATFORM_LABEL[stream.platform] || "externally")}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold shrink-0">
          {stream.username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate group-hover:text-red transition-colors">
            {stream.title}
          </p>
          <p className="text-xs text-gray-500">
            {stream.username} · {stream.game_name}
          </p>
        </div>
      </div>
    </Wrapper>
  );
}

function WatchModal({ stream, onClose }) {
  const src = buildEmbedSrc(stream.embed, typeof window !== "undefined" ? window.location.hostname : "");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Watching ${stream.title}`}
    >
      <div className="w-full max-w-5xl card p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-black">
          {src ? (
            <iframe
              src={src}
              title={stream.title}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm px-6 text-center">
              This stream can't be embedded here.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{stream.title}</p>
            <p className="text-xs text-gray-500">{stream.username} · {stream.game_name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stream.stream_url && (
              <a href={stream.stream_url} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                Open on {PLATFORM_LABEL[stream.platform] || "site"} ↗
              </a>
            )}
            <button type="button" onClick={onClose} className="btn-primary text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Stream() {
  const { isAuthenticated, user } = useAuth();

  const [streams, setStreams] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [myStream, setMyStream] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [watching, setWatching] = useState(null);
  const [form, setForm] = useState({ game_id: "", title: "", stream_url: "" });

  const loadStreams = async () => {
    setLoading(true);
    try {
      const params = gameFilter ? { game_id: gameFilter } : {};
      const res = await getLiveStreams(params);
      setStreams(res.data.streams || []);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStreams();
  }, [gameFilter]);

  // On mount, check if the current user already has an active live stream
  // This persists isLive state across page refreshes
  useEffect(() => {
    if (!isAuthenticated) return;
    API.get("/streams")
      .then((res) => {
        const active = (res.data.streams || []).find(
          (s) => s.user_id === user?.id && s.status === "live",
        );
        if (active) {
          setIsLive(true);
          setMyStream(active);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      getMyGames()
        .then((res) => setMyGames(res.data.games || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleGoLive = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await goLive(form);
      setIsLive(true);
      setShowForm(false);
      loadStreams();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to go live");
    }
  };

  const handleEndStream = async () => {
    try {
      await endStream();
      setIsLive(false);
      loadStreams();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to end stream");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title="Live Esports Streams"
        description="Watch live esports streams from top FPS players on ArenaX. Follow tournaments in real time and connect with the gaming community."
        path="/stream"
      />
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title flex items-center gap-3">
            <span className="live-dot" />
            Live Streams
          </h1>
          <p className="section-subtitle">
            {streams.length} streams live right now
          </p>
        </div>

        {isAuthenticated &&
          (isLive ? (
            <button
              onClick={handleEndStream}
              className="btn-secondary border-red/30 text-red hover:bg-red/10"
            >
              ■ End Stream
            </button>
          ) : (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? "Abort" : "● Go Live"}
            </button>
          ))}
      </div>

      {/* Broadcast form */}
      {showForm && (
        <div className="card mb-8 animate-slide-up">
          <h3 className="font-display font-bold text-lg text-white mb-4">
            Go Live
          </h3>
          <ErrorMessage message={error} />
          <form
            onSubmit={handleGoLive}
            className="grid sm:grid-cols-2 gap-4 mt-3"
          >
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Game *
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
                Stream Title *
              </label>
              <input
                className="input"
                placeholder="Ranked grind — Diamond push"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">
                Stream URL (Twitch / YouTube / Kick)
              </label>
              <input
                className="input"
                placeholder="https://twitch.tv/your_channel"
                value={form.stream_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stream_url: e.target.value }))
                }
                type="url"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Twitch channels, Kick channels and YouTube live/video links play right here on ArenaX.
                YouTube @handle links and other sites open on their own platform instead.
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary">
                Stream Now
              </button>
            </div>
          </form>
        </div>
      )}

      {isLive && (
        <div className="bg-red/10 border border-red/30 rounded-xl px-5 py-4 mb-8 flex items-center gap-3">
          <span className="live-dot" />
          <p className="text-red font-medium">🔴 You are live!</p>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <select
          className="input w-52"
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
        >
          <option value="">All games</option>
          {[...new Set(streams.map((s) => s.game_id))].map((id) => {
            const s = streams.find((s) => s.game_id === id);
            return (
              <option key={id} value={id}>
                {s?.game_name}
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : streams.length === 0 ? (
        <EmptyState
          icon="📡"
          title="No streams live right now"
          subtitle="Check back soon or be the first to go live"
          action={
            isAuthenticated && !isLive ? (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                Broadcast
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map((s) => (
            <StreamCard key={s.stream_id} stream={s} onWatch={setWatching} />
          ))}
        </div>
      )}
      {watching && <WatchModal stream={watching} onClose={() => setWatching(null)} />}
    </div>
  );
}
