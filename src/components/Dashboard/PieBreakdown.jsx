import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const PALETTE = [
  '#6366f1','#f59e0b','#10b981','#f43f5e','#0ea5e9',
  '#8b5cf6','#14b8a6','#f97316','#84cc16','#ec4899',
  '#64748b','#a3e635','#fb7185',
]

const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1 max-w-[180px] truncate">{d.name}</p>
      <div className="text-slate-600">
        <div><span>Sales: </span><span className="font-semibold">{fmt(d.value)}</span></div>
        <div><span>Share: </span><span className="font-semibold">{d.payload.pct.toFixed(1)}%</span></div>
      </div>
    </div>
  )
}

// Collapse slices below threshold into "Others"
function consolidate(data, topN = 8) {
  if (data.length <= topN) return data
  const top    = data.slice(0, topN)
  const others = data.slice(topN).reduce((acc, d) => ({
    name: 'Others',
    value: acc.value + d.value,
    pct:   acc.pct   + d.pct,
  }), { name: 'Others', value: 0, pct: 0 })
  return [...top, others]
}

const DIM_OPTIONS = [
  { value: 'therapy',  label: 'Therapy Area' },
  { value: 'product',  label: 'Product Group' },
  { value: 'division', label: 'Division' },
]

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
  if (pct < 5) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {pct.toFixed(0)}%
    </text>
  )
}

export default function PieBreakdown({ pie }) {
  const [dim, setDim] = useState('therapy')
  const raw  = pie[dim] || []
  const data = consolidate(raw, 8)

  return (
    <div className="card px-5 py-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Sales Contribution</h3>
          <p className="text-xs text-slate-400 mt-0.5">Share of Net Sales by selected dimension</p>
        </div>
        <select
          value={dim}
          onChange={e => setDim(e.target.value)}
          className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-3 py-1.5
            focus:outline-none focus:border-brand-400 transition-all cursor-pointer text-slate-700"
        >
          {DIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex-1 min-h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={50}
            paddingAngle={2}
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 && data[i].name === 'Others' ? '#cbd5e1' : PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value) => <span style={{ color: '#64748b', fontSize: 10 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
