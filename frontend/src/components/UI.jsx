// Spinner.jsx
export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size]
  return (
    <div className={`${s} border-2 border-surface-border border-t-red rounded-full animate-spin`} />
  )
}

// PageLoader — full page centered spinner
export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

// PageHeader — consistent section titles
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// EmptyState — when no data
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="text-5xl mb-4 opacity-30">{icon}</div>}
      <p className="text-gray-300 font-medium text-lg">{title}</p>
      {subtitle && <p className="text-gray-500 text-sm mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// ErrorMessage — inline error banner
export function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <div className="bg-red/10 border border-red/30 text-red-light rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  )
}

// StatCard — used in profile
export function StatCard({ label, value, sub }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-display font-bold text-white">{value ?? '—'}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-red mt-0.5">{sub}</p>}
    </div>
  )
}
