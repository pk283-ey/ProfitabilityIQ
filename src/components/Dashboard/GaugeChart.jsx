import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Label, LabelList,
} from 'recharts'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const DIM_OPTIONS = [
  { value: '',              label: 'All'          },
  { value: 'Therapy Area',  label: 'Therapy Area' },
  { value: 'Product Group', label: 'Product Group'},
  { value: 'Divison',       label: 'Division'     },
]

// Scenario colours — distinct, never changes
const SCENARIO_COLOR = {
  Actuals:          '#6366f1',   // indigo
  'Latest Estimate':'#f59e0b',   // amber
  Budget:           '#10b981',   // emerald
}

const fmt = (n) => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function sum(arr, key) {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

// Aggregate full-period totals per scenario — no month slicing
function computeGauge(rows) {
  const actSales = sum(rows.filter(r => r.Scenario === 'Actuals'),         'Sales')
  const budSales = sum(rows.filter(r => r.Scenario === 'Budgeted'),        'Sales')
  const leSales  = sum(rows.filter(r => r.Scenario === 'Latest Estimate'), 'Sales')
  if (actSales === 0 && budSales === 0 && leSales === 0) return null
  return {
    actuals:    actSales,
    budget:     budSales,
    le:         leSales,
    actualsPct: budSales > 0 ? actSales / budSales * 100 : 0,
    lePct:      budSales > 0 ? leSales  / budSales * 100 : 0,
  }
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d?.scenario}</p>
      <p className="text-slate-500">{fmt(d?.value)}</p>
      {d?.pct != null && (
        <p className={`font-bold mt-0.5 ${d.pct >= 100 ? 'text-emerald-600' : d.pct >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
          {d.pct.toFixed(1)}% of Budget
        </p>
      )}
    </div>
  )
}

export default function GaugeChart({ rawData, filters }) {
  const [dimType,  setDimType]  = useState('')
  const [dimValue, setDimValue] = useState('')

  const baseRows = useMemo(() => rawData.filter(row => {
    if (filters.sbu           !== 'All' && row['SBU']               !== filters.sbu)           return false
    if (filters.year          !== 'All' && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All' && row['FiscalQuarter']     !== filters.fiscalQuarter) return false
    return true
  }), [rawData, filters.sbu, filters.year, filters.fiscalQuarter])

  const dimValues = useMemo(() => {
    if (!dimType) return []
    return [...new Set(baseRows.map(r => r[dimType]).filter(Boolean))].sort()
  }, [baseRows, dimType])

  const handleDimTypeChange = (v) => { setDimType(v); setDimValue('') }

  const gaugeRows = useMemo(() => {
    if (!dimType || !dimValue) return baseRows
    return baseRows.filter(r => r[dimType] === dimValue)
  }, [baseRows, dimType, dimValue])

  const gaugeData = useMemo(() => computeGauge(gaugeRows), [gaugeRows])

  const periodLabel = filters.year !== 'All'
    ? (filters.fiscalQuarter !== 'All' ? `FY${filters.year} · ${filters.fiscalQuarter}` : `FY${filters.year}`)
    : 'All Years'

  const { actuals = 0, budget = 0, le = 0, actualsPct = 0, lePct = 0 } = gaugeData || {}

  // Build chart rows — only include LE if data exists
  const chartData = [
    { scenario: 'Actuals',     name: 'Actuals',     value: actuals, pct: actualsPct, color: SCENARIO_COLOR['Actuals'] },
    ...(le > 0 ? [{ scenario: 'Latest Est.', name: 'Latest Est.', value: le, pct: lePct, color: SCENARIO_COLOR['Latest Estimate'] }] : []),
    { scenario: 'Budget',      name: 'Budget',      value: budget,  pct: 100,        color: SCENARIO_COLOR['Budget'] },
  ]

  const maxVal = Math.max(actuals, budget, le || 0) * 1.15

  const StatusIcon = actualsPct >= 100 ? CheckCircle : actualsPct >= 80 ? AlertTriangle : XCircle
  const statusBg   = actualsPct >= 100
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : actualsPct >= 80
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-red-50 border-red-200 text-red-600'
  const statusMsg  = budget > 0
    ? actualsPct >= 100
      ? `Budget achieved — Actuals ${(actualsPct - 100).toFixed(0)}% above target`
      : `${(100 - actualsPct).toFixed(0)}% below budget target`
    : `Actuals: ${fmt(actuals)} (no budget data)`

  const selectCls = 'text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-400 transition-all cursor-pointer text-slate-700'

  return (
    <div className="card px-5 py-4 flex flex-col gap-4 h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Actuals + LE vs Budget</h3>
          <p className="text-xs text-slate-400 mt-0.5">Period: <span className="font-semibold text-slate-600">{periodLabel}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={dimType} onChange={e => handleDimTypeChange(e.target.value)} className={selectCls}>
            {DIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {dimType && (
            <select value={dimValue} onChange={e => setDimValue(e.target.value)} className={selectCls}>
              <option value="">— select —</option>
              {dimValues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
      </div>

      {!gaugeData ? (
        /* ── No data for this dimension slice ── */
        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[200px]">
          <span className="text-2xl">📭</span>
          <p className="text-sm font-medium text-slate-500">No data available</p>
          <p className="text-xs text-slate-400 text-center">
            {dimValue
              ? `No records found for "${dimValue}"`
              : 'No data matches the current filters'}
          </p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 24, left: 8 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}>
                  <Label value="Scenario" offset={-6} position="insideBottom"
                    style={{ fontSize: 10, fill: '#94a3b8' }} />
                </XAxis>
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={fmt} width={64} domain={[0, maxVal]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={fmt}
                    style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  />
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.88} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Colour legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            {chartData.map(d => (
              <div key={d.scenario} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span>{d.scenario}</span>
                {d.pct != null && d.scenario !== 'Budget' && (
                  <span className={`font-semibold ${d.pct >= 100 ? 'text-emerald-600' : d.pct >= 80 ? 'text-amber-600' : 'text-red-500'}`}>
                    ({d.pct.toFixed(0)}%)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Status banner */}
          <div className={`flex items-center gap-2 text-xs rounded-xl border px-3 py-2.5 ${statusBg}`}>
            <StatusIcon size={14} className="shrink-0" />
            <span className="font-medium">{statusMsg}</span>
          </div>
        </>
      )}
    </div>
  )
}
