import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell, Label,
} from 'recharts'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const fmt = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

// Horizontal progress bar for one scenario
function ProgressBar({ label, value, budget, color, pct }) {
  const capped    = Math.min(pct, 100)
  const exceeded  = pct > 100
  const barColor  = pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#f43f5e'
  const textColor = pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">{fmt(value)}</span>
          <span className={`font-bold tabular-nums ${textColor}`}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
        {/* Achieved portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${capped}%`, background: color, opacity: 0.9 }}
        />
        {/* Exceeded extension (beyond 100% mark) */}
        {exceeded && (
          <div
            className="absolute top-0 h-full rounded-r-full"
            style={{
              left: '66.67%',
              width: `${Math.min((pct - 100) / 50 * 33.33, 33.33)}%`,
              background: '#10b981',
            }}
          />
        )}
        {/* Budget reference line at 66.67% of bar width (100% of budget) */}
        <div className="absolute top-0 h-full w-px bg-slate-400 opacity-60" style={{ left: '66.67%' }} />
        {/* Label inside bar */}
        {capped > 20 && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white drop-shadow-sm">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700">{d?.name}</p>
      <p className="text-slate-500 mt-0.5">{fmt(d?.value)}</p>
      {d?.pct != null && (
        <p className={`font-bold mt-0.5 ${d.pct >= 100 ? 'text-emerald-600' : d.pct >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
          {d.pct.toFixed(0)}% of budget
        </p>
      )}
    </div>
  )
}

export default function GaugeChart({ gaugeData }) {
  if (!gaugeData) {
    return (
      <div className="card px-5 py-4 flex items-center justify-center h-full min-h-[320px]">
        <p className="text-sm text-slate-400">No budget data for current filters</p>
      </div>
    )
  }

  const { month, actuals, budget, le, actualsPct, lePct } = gaugeData

  // Scale: bar chart showing absolute values with budget reference line
  const chartData = [
    { name: 'Actuals',        value: actuals, color: '#6366f1', pct: actualsPct },
    { name: 'Latest Est.',    value: le || 0, color: '#8b5cf6', pct: lePct      },
    { name: 'Budget',         value: budget,  color: '#94a3b8', pct: 100        },
  ]

  const maxVal = Math.max(actuals, budget, le || 0) * 1.12

  // Status banner
  const StatusIcon  = actualsPct >= 100 ? CheckCircle : actualsPct >= 80 ? AlertTriangle : XCircle
  const statusBg    = actualsPct >= 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : actualsPct >= 80 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-600'
  const statusMsg   = actualsPct >= 100
    ? `Budget achieved — Actuals ${(actualsPct - 100).toFixed(0)}% above target`
    : `${(100 - actualsPct).toFixed(0)}% below budget target for ${month}`

  return (
    <div className="card px-5 py-4 flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Actuals + LE vs Budget</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Latest Actuals month: <span className="font-semibold text-slate-600">{month}</span>
        </p>
      </div>

      {/* Progress bars */}
      <div className="flex flex-col gap-3">
        <ProgressBar label="Actuals"     value={actuals} budget={budget} color="#6366f1" pct={actualsPct} />
        {le > 0 && <ProgressBar label="Latest Est." value={le}      budget={budget} color="#8b5cf6" pct={lePct} />}
        {/* Budget reference row */}
        <div className="flex items-center justify-between text-xs pt-0.5 border-t border-slate-100">
          <span className="text-slate-400">Budget (100%)</span>
          <span className="font-bold text-slate-600">{fmt(budget)}</span>
        </div>
      </div>

      {/* Bar chart — absolute value comparison */}
      <div className="flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 24, left: 8 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}>
              <Label value="Scenario" offset={-6} position="insideBottom"
                style={{ fontSize: 10, fill: '#94a3b8' }} />
            </XAxis>
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              tickFormatter={fmt} width={64} domain={[0, maxVal]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={budget} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'Budget', position: 'right', fontSize: 9, fill: '#6366f1' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.pct >= 100 ? '#10b981' : d.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-2 text-xs rounded-xl border px-3 py-2.5 ${statusBg}`}>
        <StatusIcon size={14} className="shrink-0" />
        <span className="font-medium">{statusMsg}</span>
      </div>
    </div>
  )
}
