import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTournaments } from '../services/tournamentService'
import { getLiveStreams } from '../services/streamService'
import TournamentCard from '../components/TournamentCard'
import { Spinner } from '../components/UI'

export default function Home() {
  const [tournaments, setTournaments] = useState([])
  const [streams, setStreams]         = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.allSettled([
          getTournaments({ limit: 3, status: 'upcoming' }),
          getLiveStreams({ limit: 4 }),
        ])
        if (tRes.status === 'fulfilled') setTournaments(tRes.value.data.tournaments || [])
        if (sRes.status === 'fulfilled') setStreams(sRes.value.data.streams || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-red-glow pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32 relative">
          <div className="max-w-2xl">
            <div className="badge-red mb-6 inline-flex">
              <span className="live-dot mr-1.5" /> Live tournaments happening now
            </div>
            <h1 className="font-display font-bold text-5xl md:text-7xl text-white leading-none tracking-tight mb-6">
              COMPETE.<br />
              <span className="text-gradient">CONQUER.</span><br />
              CONNECT.
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
              The ultimate platform for eSports. Find tournaments, build your team,
              stream your matches, and rise through the ranks.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/tournament" className="btn-primary text-base px-8 py-3">
                Browse Tournaments
              </Link>
              <Link to="/teamfinder" className="btn-secondary text-base px-8 py-3">
                Find Teammates
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative right side */}
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none hidden lg:block"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, #ff4655 0%, transparent 60%)' }} />
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-surface-border bg-surface-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Active Players',    value: '50K+' },
            { label: 'Tournaments Hosted',value: '1,200+' },
            { label: 'Prize Money Paid',  value: '$2M+' },
            { label: 'Games Supported',   value: '25+' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-display font-bold text-2xl text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-16">
        {/* ── Upcoming Tournaments ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-title">Upcoming Tournaments</h2>
              <p className="section-subtitle">Register before spots fill up</p>
            </div>
            <Link to="/tournament" className="btn-ghost text-sm">View all →</Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map(t => <TournamentCard key={t.tournament_id} tournament={t} />)}
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-500">
              No upcoming tournaments yet.{' '}
              <Link to="/tournament" className="text-red hover:underline">Check back soon</Link>
            </div>
          )}
        </section>

        {/* ── Live Streams ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-title flex items-center gap-3">
                <span className="live-dot" />
                Live Streams
              </h2>
              <p className="section-subtitle">Watch top players compete right now</p>
            </div>
            <Link to="/stream" className="btn-ghost text-sm">See all →</Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : streams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {streams.map(s => (
                <a key={s.stream_id} href={s.stream_url || '#'} target="_blank" rel="noreferrer"
                  className="card-hover group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm">
                      {s.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.username}</p>
                      <p className="text-xs text-gray-500">{s.game_name}</p>
                    </div>
                    <span className="badge-red shrink-0"><span className="live-dot mr-1" />LIVE</span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{s.title}</p>
                  <p className="text-xs text-gray-600 mt-2">{s.viewer_count?.toLocaleString()} viewers</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-500">
              No live streams right now.{' '}
              <Link to="/stream" className="text-red hover:underline">Start one</Link>
            </div>
          )}
        </section>

        {/* ── CTA ── */}
        <section className="card text-center py-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-red-glow pointer-events-none" />
          <h2 className="font-display font-bold text-3xl text-white mb-3 relative">
            Ready to compete?
          </h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto relative">
            Create your account, pick your games and jump into your first tournament today.
          </p>
          <div className="flex justify-center gap-4 relative">
            <Link to="/register" className="btn-primary px-8 py-3 text-base">
              Create Free Account
            </Link>
            <Link to="/games" className="btn-secondary px-8 py-3 text-base">
              Browse Games
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
