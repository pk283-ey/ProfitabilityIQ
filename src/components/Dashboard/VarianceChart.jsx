import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { computeVarianceByDimension } from '../../lib/varianceCalculator.js'
import { TrendingUp, TrendingDown } from 'lucide-react'

const fmt = (n) => {
  const sign = n >= 0 ? '+' : ''
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`
  return `${sign}$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2 max-w-[180px] truncate">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span>{p.name}:</span>
          <span className={`font-semibold ${p.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const DIM_OPTIONS = [
  { value: 'Therapy Area', label: 'Therapy Area' },
  { value: 'Divison',      label: 'Division' },
  { value: 'Dosage Form',  label: 'Dosage Form' },
]

export default function VarianceChart({ rawData, filters }) {
  const [dim, setDim] = useState('Therapy Area')
  const [metric, setMetric] = useState('sales') // 'sales' | 'margin'

  const varData = useMemo(() =>
    computeVarianceByDimension(rawData, filters, dim),
    [rawData, filters, dim]
  )

  const { results, totals } = varData

  const chartData = results.slice(0, 10).map(r => ({
    name: r.name.length > 18 ? r.name.slice(0, 18) + '…' : r.name,
    fullName: r.name,
    priceVar:  metric === 'sales' ? r.priceVariance  : r.marginPriceVariance,
    volumeVar: metric === 'sales' ? r.volumeVariance : r.marginVolumeVariance,
    ...(metric === 'margin' ? { costVar: r.marginCostVariance } : {}),
    total:     metric === 'sales' ? r.totalSalesVariance : r.totalMarginVariance,
  }))

  const favCount = results.filter(r => r.totalSalesVariance > 0).length
  const unfavCount = results.length - favCount
  const biggestFav  = results.find(r => r.totalSalesVariance > 0)
  const biggestUnfav = results.slice().reverse().find(r => r.totalSalesVariance < 0)

  return (
    <div className="card px-5 py-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Price &amp; Volume Variance</h3>
          <p className="text-xs text-slate-400 mt-0.5">Actuals vs Budget · green = favourable</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dim}
            onChange={e => setDim(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5
              focus:outline-none focus:border-brand-400 transition-all cursor-pointer text-slate-700"
          >
            {DIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5
              focus:outline-none focus:border-brand-400 transition-all cursor-pointer text-slate-700"
          >
            <option value="sales">Sales Variance</option>
            <option value="margin">Margin Variance</option>
          </select>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
          <span className="font-semibold text-slate-600">Total Variance:</span>
          <span className={`font-bold ${totals.totalSalesVariance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmt(metric === 'sales' ? totals.totalSalesVariance : totals.totalMarginVariance)}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs text-emerald-700">
          <TrendingUp size={11} /> {favCount} favourable
        </div>
        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-xs text-red-600">
          <TrendingDown size={11} /> {unfavCount} unfavourable
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 44, left: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
            width={68}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            formatter={(v) => <span style={{ color: '#64748b' }}>{v}</span>}
          />
          <Bar dataKey="priceVar" name="Price Variance" stackId="a" radius={[0,0,0,0]} maxBarSize={40}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.priceVar >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.85} />
            ))}
          </Bar>
          <Bar dataKey="volumeVar" name="Volume Variance" stackId="a" radius={[3,3,0,0]} maxBarSize={40}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.volumeVar >= 0 ? '#34d399' : '#fb7185'} fillOpacity={0.7} />
            ))}
          </Bar>
          {metric === 'margin' && (
            <Bar dataKey="costVar" name="Cost Variance" stackId="a" radius={[3,3,0,0]} maxBarSize={40}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.costVar >= 0 ? '#a7f3d0' : '#fca5a5'} fillOpacity={0.7} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
      </div>

      {/* AI-style analytical callouts */}
      <div className="flex flex-col gap-2 text-xs">
        {biggestFav && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <TrendingUp size={12} className="text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-emerald-700">
              <span className="font-semibold">{biggestFav.name}</span> is the top value creator with{' '}
              <span className="font-semibold">{fmt(biggestFav.totalSalesVariance)}</span> favourable sales variance
              (Price: {fmt(biggestFav.priceVariance)} | Volume: {fmt(biggestFav.volumeVariance)})
            </span>
          </div>
        )}
        {biggestUnfav && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <TrendingDown size={12} className="text-red-500 mt-0.5 shrink-0" />
            <span className="text-red-700">
              <span className="font-semibold">{biggestUnfav.name}</span> is the biggest value eroder at{' '}
              <span className="font-semibold">{fmt(biggestUnfav.totalSalesVariance)}</span> below budget
              (Price: {fmt(biggestUnfav.priceVariance)} | Volume: {fmt(biggestUnfav.volumeVariance)})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
