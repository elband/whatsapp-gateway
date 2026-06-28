import { PageSpinner } from './Spinner'
import EmptyState from './EmptyState'

/**
 * columns: [{ key, header, render?(row), className?, headerClassName? }]
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  rowKey = (r) => r.id,
  empty,
  onRowClick,
}) {
  if (loading) return <PageSpinner />
  if (!data || data.length === 0) {
    return empty || <EmptyState />
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ' +
                    (c.headerClassName || '')
                  }
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50'}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={'px-4 py-3 text-slate-700 ' + (c.className || '')}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
