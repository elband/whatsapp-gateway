import { cn } from '../lib/utils'
import { statusTone } from '../lib/utils'

const TONES = {
  green: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export default function Badge({ children, tone, status, className }) {
  const t = tone || statusTone(status || children)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[t] || TONES.gray,
        className
      )}
    >
      {children}
    </span>
  )
}
