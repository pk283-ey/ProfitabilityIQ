import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, Label,
} from 'recharts'
import { ArrowUpDown } from 'lucide-react'

const DIMS = [
  { label: 'Therapy Area',  key: 'Therapy Area'  },
  { label: 'Dosage Form',   key: 'Dosage Form'   },
  { label: 'Product Group', key: 'Product Group' },
  { label: 'Division',      key: 'Divison'       },
]

const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">
            {p.name === 'Margin %' ? `${Number(p.value).toFixed(1)}%` : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// Aggregate filteredData by a given dimension key
function aggregate(data, dimKey) {
  const map = {}
  for (const row of data) {
    const k = row[dimKey] ?? 'Unknown'
    if (!map[k]) map[k] = { name: k, sales: 0, margin: 0 }
    map[k].sales  += Number(row['Sales'])  || 0
    map[k].margin += Number(row['Margin']) || 0
  }
  return Object.values(map).map(d => ({
    ...d,
    marginPct: d.sales > 0 ? d.margin / d.sales * 100 : 0,
  }))
}

export default function ComboChart({ filteredData }) {
  const [showBottom, setShowBottom] = useState(false)
  const [dimKey, setDimKey]         = useState('Dosage Form')
  const [topN, setTopN]             = useState(8)

  const dimLabel = DIMS.find(d => d.key === dimKey)?.label || dimKey

  const sorted = useMemo(() => {
    const agg = aggregate(filteredData, dimKey)
    return showBottom
      ? [...agg].sort((a, b) => a.sales - b.sales).slice(0, topN)
      : [...agg].sort((a, b) => b.sales - a.sales).slice(0, topN)
  }, [filteredData, dimKey, topN, showBottom])

  return (
    <div className="card px-5 py-4 flex flex-col gap-3 h-full">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            {showBottom ? `Bottom ${topN}` : `Top ${topN}`} — Net Sales by {dimLabel}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Bars = Net Sales · Line = Margin %</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dimension dropdown */}
          <select
            value={dimKey}
            onChange={e => setDimKey(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:border-brand-400 cursor-pointer"
          >
            {DIMS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>

          {/* Top N slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">N =</span>
            <input
              type="range" min={5} max={10} step={1} value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="w-20 accent-brand-600 cursor-pointer"
            />
            <span className="text-xs font-semibold text-brand-600 w-3">{topN}</span>
          </div>

          {/* Top / Bottom toggle */}
          <button
            onClick={() => setShowBottom(b => !b)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
              ${showBottom
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <ArrowUpDown size={12} />
            {showBottom ? `Top ${topN}` : `Bottom ${topN}`}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sorted} margin={{ top: 8, right: 48, bottom: 52, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={60}
            >
              <Label value={dimLabel} offset={-4} position="insideBottom" style={{ fontSize: 10, fill: '#94a3b8' }} />
            </XAxis>

            <YAxis
              yAxisId="sales"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmt}
              width={72}
            >
              <Label value="Net Sales (USD)" angle={-90} position="insideLeft" offset={12}
                style={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'middle' }} />
            </YAxis>

            <YAxis
              yAxisId="margin"
              orientation="right"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(0)}%`}
              width={44}
              domain={[0, 'auto']}
            >
              <Label value="Margin %" angle={90} position="insideRight" offset={-4}
                style={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'middle' }} />
            </YAxis>

            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(v) => <span style={{ color: '#64748b' }}>{v}</span>} />

            <Bar yAxisId="sales" dataKey="sales" name="Net Sales" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {sorted.map((_, i) => (
                <Cell key={i} fill={showBottom ? '#f43f5e' : '#6366f1'} fillOpacity={1 - i * 0.06} />
              ))}
            </Bar>

            <Line
              yAxisId="margin"
              type="monotone"
              dataKey="marginPct"
              name="Margin %"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
