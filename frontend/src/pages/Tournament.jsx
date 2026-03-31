import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournaments, getTournamentById, registerForTournament } from '../services/tournamentService'
import TournamentCard from '../components/TournamentCard'
import { PageLoader, PageHeader, EmptyState, ErrorMessage, Spinner } from '../components/UI'
import { useAuth } from '../context/AuthContext'

// ── Detail view (when :id param exists) ────────────────────────────────────────
function TournamentDetail({ id }) {
  const { isAuthenticated, user } = useAuth()
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [teamId, setTeamId]         = useState('')
  const [registering, setRegistering] = useState(false)
  const [success, setSuccess]       = useState('')

  useEffect(() => {
    getTournamentById(id)
      .then(res => setTournament(res.data.tournament))
      .catch(() => setError('Tournament not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!teamId) return setError('Enter your team ID')
    setRegistering(true)
    setError('')
    try {
      await registerForTournament(id, { team_id: Number(teamId) })
      setSuccess('Your team has been registered!')
      setTeamId('')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  if (loading) return <PageLoader />
  if (!tournament) return <div className="max-w-3xl mx-auto px-4 py-10"><ErrorMessage message={error} /></div>

  const t = tournament
  const startDate = t.start_date ? new Date(t.start_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <Link to="/tournament" className="text-gray-500 hover:text-white text-sm flex items-center gap-1 mb-6 transition-colors">
        ← Back to Tournaments
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">{t.game_name}</p>
            <h1 className="font-display font-bold text-3xl text-white">{t.name}</h1>
          </div>
          <span className={`badge ${t.status === 'upcoming' ? 'badge-blue' : t.status === 'ongoing' ? 'badge-green' : 'badge-gray'}`}>
            {t.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Prize Pool',  value: t.prize_pool ? `$${Number(t.prize_pool).toLocaleString()}` : 'N/A' },
            { label: 'Entry Fee',   value: Number(t.entry_fee) === 0 ? 'Free' : `$${t.entry_fee}` },
            { label: 'Region',      value: t.region || 'Global' },
            { label: 'Format',      value: t.format?.replace(/_/g, ' ') || 'TBD' },
          ].map(s => (
            <div key={s.label} className="bg-navy rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="font-semibold text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 divider text-sm text-gray-400">
          Starts: <span className="text-white ml-1">{startDate}</span>
        </div>
      </div>

      {/* Teams */}
      {t.registered_teams?.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-bold text-lg text-white mb-4">
            Registered Teams ({t.registered_teams.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {t.registered_teams.map(team => (
              <span key={team.team_id} className="badge-gray">{team.team_name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      {t.matches?.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-bold text-lg text-white mb-4">Bracket</h2>
          <div className="flex flex-col gap-2">
            {t.matches.map(m => (
              <div key={m.match_id} className="bg-navy rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <span className={`font-medium text-sm ${m.winner_team_id === m.team1_id ? 'text-white' : 'text-gray-500'}`}>
                  {m.team1_name}
                </span>
                <span className="text-gray-600 text-xs font-mono">{m.score || 'vs'}</span>
                <span className={`font-medium text-sm ${m.winner_team_id === m.team2_id ? 'text-white' : 'text-gray-500'}`}>
                  {m.team2_name || 'TBD'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register */}
      {isAuthenticated && t.status === 'upcoming' && (
        <div className="card">
          <h2 className="font-display font-bold text-lg text-white mb-1">Register Your Team</h2>
          <p className="text-gray-500 text-sm mb-4">You must be the captain of your team to register.</p>

          {success
            ? <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">{success}</div>
            : (
              <form onSubmit={handleRegister} className="flex gap-3">
                <ErrorMessage message={error} />
                <input
                  className="input flex-1"
                  placeholder="Your Team ID"
                  value={teamId}
                  onChange={e => setTeamId(e.target.value)}
                  type="number"
                  min="1"
                />
                <button type="submit" disabled={registering} className="btn-primary shrink-0">
                  {registering ? <Spinner size="sm" /> : 'Register'}
                </button>
              </form>
            )
          }
        </div>
      )}

      {!isAuthenticated && (
        <div className="card text-center py-8">
          <p className="text-gray-400 mb-4">Sign in to register your team for this tournament</p>
          <Link to="/login" className="btn-primary">Sign In</Link>
        </div>
      )}
    </div>
  )
}

// ── List view ────────────────────────────────────────────────────────────────
function TournamentList() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [filters, setFilters]         = useState({ status: '', region: '' })

  useEffect(() => {
    setLoading(true)
    getTournaments(filters)
      .then(res => setTournaments(res.data.tournaments || []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false))
  }, [filters])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <PageHeader
        title="Tournaments"
        subtitle="Find and join eSports tournaments from around the world"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <select
          className="input w-44"
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>
        <input
          className="input w-44"
          placeholder="Region..."
          value={filters.region}
          onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
        />
      </div>

      {loading ? (
        <PageLoader />
      ) : tournaments.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No tournaments found"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tournaments.map(t => (
            <TournamentCard key={t.tournament_id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Tournament() {
  const { id } = useParams()
  return id ? <TournamentDetail id={id} /> : <TournamentList />
}
