import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

export default function Spinner({ className, size = 20, label }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-slate-500', className)}>
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function PageSpinner({ label = 'Loading...' }) {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <Spinner size={28} label={label} />
    </div>
  )
}
