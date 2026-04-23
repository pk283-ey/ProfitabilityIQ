import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Label,
} from 'recharts'

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
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TrendChart({ monthlyData }) {
  return (
    <div className="card px-5 py-4 flex flex-col gap-3 h-full">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Monthly Performance Trend</h3>
        <p className="text-xs text-slate-400 mt-0.5">Net Sales &amp; Margin · FY2026</p>
      </div>

      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthlyData} margin={{ top: 8, right: 16, bottom: 36, left: 8 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              height={44}
            >
              <Label value="Month (FY2026)" offset={-6} position="insideBottom"
                style={{ fontSize: 10, fill: '#94a3b8' }} />
            </XAxis>

            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmt}
              width={72}
            >
              <Label value="USD" angle={-90} position="insideLeft" offset={12}
                style={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'middle' }} />
            </YAxis>

            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => <span style={{ color: '#64748b' }}>{v}</span>} />

            <Area type="monotone" dataKey="sales"  name="Net Sales"
              stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGrad)"
              dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="margin" name="Margin"
              stroke="#10b981" strokeWidth={2.5} fill="url(#marginGrad)"
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
