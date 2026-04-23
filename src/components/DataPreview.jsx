import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const NUM_COLS = new Set(['Sales Volume', 'Sales', 'COGM', 'Margin', 'MonthNum', 'Year', 'FiscalYear'])
const PAGE_SIZE = 10

function fmt(v, col) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>
  if (NUM_COLS.has(col) && typeof v === 'number') {
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
    return v.toLocaleString()
  }
  return String(v)
}

export default function DataPreview({ previewData, previewCols, totalRows }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(previewData.length / PAGE_SIZE)
  const rows  = previewData.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Data Preview</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Showing first {previewData.length} of {totalRows.toLocaleString()} rows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{page + 1} / {pages}</span>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {previewCols.map(c => (
                <th key={c} className={NUM_COLS.has(c) ? 'num' : ''}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {previewCols.map(c => (
                  <td key={c} className={NUM_COLS.has(c) ? 'num' : ''}>
                    {fmt(row[c], c)}
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
