import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page = 1, totalPages = 1, total, onChange }) {
  if (!totalPages || totalPages <= 1) {
    return total != null ? (
      <div className="flex items-center justify-end px-1 py-2 text-sm text-slate-500">
        {total} item{total === 1 ? '' : 's'}
      </div>
    ) : null
  }

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} of {totalPages}
        {total != null ? ` · ${total} items` : ''}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary px-2 py-1.5"
          disabled={page <= 1}
          onClick={() => onChange?.(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-secondary px-2 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onChange?.(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
