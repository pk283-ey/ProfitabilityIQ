import { useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label,
} from 'recharts'

const PALETTE = [
  '#6366f1','#f59e0b','#10b981','#f43f5e','#0ea5e9',
  '#8b5cf6','#14b8a6','#f97316','#84cc16','#ec4899',
]

const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs max-w-[200px]">
      <p className="font-semibold text-slate-700 mb-2 truncate">{d.name}</p>
      <div className="flex flex-col gap-1 text-slate-600">
        <div className="flex justify-between gap-4"><span>Net Sales</span><span className="font-semibold">{fmt(d.x)}</span></div>
        <div className="flex justify-between gap-4"><span>Margin %</span><span className="font-semibold">{d.y.toFixed(1)}%</span></div>
        <div className="flex justify-between gap-4"><span>Volume</span><span className="font-semibold">{d.z.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>
      </div>
    </div>
  )
}

const DIM_OPTIONS = [
  { value: 'therapy',  label: 'Therapy Area' },
  { value: 'product',  label: 'Product Group' },
  { value: 'division', label: 'Division' },
]

export default function BubbleChart({ bubble }) {
  const [dim, setDim] = useState('therapy')
  const data = bubble[dim] || []

  // Scale Z values to a reasonable range
  const maxZ = Math.max(...data.map(d => d.z), 1)
  const minZ = Math.min(...data.map(d => d.z).filter(v => v > 0), maxZ)

  return (
    <div className="card px-5 py-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Sales vs Margin — Bubble Chart</h3>
          <p className="text-xs text-slate-400 mt-0.5">X = Net Sales · Y = Margin % · Size = Volume</p>
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
        <ScatterChart margin={{ top: 4, right: 20, bottom: 28, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            type="number"
            dataKey="x"
            name="Net Sales"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
            width={72}
          >
            <Label value="Net Sales" position="insideBottom" offset={-12} style={{ fontSize: 10, fill: '#94a3b8' }} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            name="Margin %"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v.toFixed(0)}%`}
            width={44}
          >
            <Label value="Margin %" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#94a3b8' }} />
          </YAxis>
          <ZAxis
            type="number"
            dataKey="z"
            range={[40, 1200]}
            name="Volume"
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          <Scatter data={data} fillOpacity={0.75}>
            {data.map((entry, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      </div>

      {/* Mini legend */}
      <div className="flex flex-wrap gap-2">
        {data.slice(0, 10).map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="truncate max-w-[80px]">{d.name}</span>
          </div>
        ))}
        {data.length > 10 && <span className="text-[10px] text-slate-400">+{data.length - 10} more</span>}
      </div>
    </div>
  )
}
