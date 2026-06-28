import { cn } from '../lib/utils'

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
  purple: 'bg-purple-50 text-purple-600',
}

export default function StatCard({ label, value, icon: Icon, tone = 'brand', hint }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      {Icon && (
        <div className={cn('rounded-xl p-3', TONES[tone] || TONES.brand)}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value ?? '-'}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}
