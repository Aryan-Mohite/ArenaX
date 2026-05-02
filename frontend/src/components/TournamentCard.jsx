import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { themeStyles } from '../utils/themeStyles'

const STATUS_STYLES = {
  upcoming:  'badge-blue',
  ongoing:   'badge-green',
  completed: 'badge-gray',
  cancelled: 'badge-red',
}

const FORMAT_LABELS = {
  single_elimination: 'Single Elim',
  double_elimination: 'Double Elim',
  round_robin:        'Round Robin',
  swiss:              'Swiss',
}

export default function TournamentCard({ tournament }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";
  const {
    tournament_id, name, game_name, game_icon,
    prize_pool, entry_fee, region, format,
    start_date, status, registered_teams,
  } = tournament

  const statusClass = STATUS_STYLES[status] || 'badge-gray'
  const startDate   = start_date ? new Date(start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <Link to={`/tournament/${tournament_id}`} className="card-hover flex flex-col gap-3 group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-white text-lg leading-tight group-hover:text-red transition-colors truncate">
            {name}
          </h3>
          <p className="text-gray-400 text-sm mt-0.5">{game_name}</p>
        </div>
        <span className={statusClass}>{status}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        {prize_pool > 0 && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Prize Pool</p>
            <p className="text-sm font-semibold text-red">${Number(prize_pool).toLocaleString()}</p>
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
              {Number(entry_fee) === 0 ? 'Free' : `$${Number(entry_fee)}`}
            </p>
          </div>
        )}
        {registered_teams !== undefined && (
          <div className="bg-navy rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Teams</p>
            <p className="text-sm font-medium text-gray-300">{registered_teams}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 divider">
        <div className="flex items-center gap-2 mt-2">
          {format && <span className="badge-gray">{FORMAT_LABELS[format] || format}</span>}
        </div>
        {startDate && <p className="text-xs text-gray-500 mt-2">{startDate}</p>}
      </div>
    </Link>
  )
}
