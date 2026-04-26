import { useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts'

const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

// ── Anomaly detection (z-score on sales, correlated with margin) ──────────────
function detectAnomalies(data, prevMap) {
  if (data.length < 4) return new Map()
  const salesVals = data.map(d => d.sales)
  const mean = salesVals.reduce((s, v) => s + v, 0) / salesVals.length
  const std  = Math.sqrt(salesVals.reduce((s, v) => s + (v - mean) ** 2, 0) / salesVals.length)
  if (std === 0) return new Map()

  const avgMPct = data.reduce((s, r) => s + (r.sales > 0 ? r.margin / r.sales * 100 : 0), 0) / data.length
  const result  = new Map()

  for (const d of data) {
    const z     = (d.sales - mean) / std
    const mPct  = d.sales > 0 ? d.margin / d.sales * 100 : 0
    const pct   = ((d.sales - mean) / mean * 100).toFixed(0)
    const prev  = prevMap[d.month]
    const yoyPct = prev?.sales > 0 ? ((d.sales - prev.sales) / prev.sales * 100) : null

    const isTrendAnomaly = Math.abs(z) >= 1.2
    const isYoYAnomaly   = yoyPct !== null && Math.abs(yoyPct) >= 20

    if (!isTrendAnomaly && !isYoYAnomaly) continue

    let label = ''
    if (isTrendAnomaly) {
      const sign = z > 0 ? `+${pct}%` : `${pct}%`
      if (z > 0) {
        label = mPct > avgMPct
          ? `Sales spike (${sign} vs period avg) — Price-led: margin also expanded`
          : `Sales spike (${sign} vs period avg) — Volume/mix-led: margin compression noted`
      } else {
        label = mPct > avgMPct
          ? `Revenue shortfall (${sign} vs period avg) — Margin held: favorable mix`
          : `Sales & margin decline (${sign} vs period avg) — Broad demand weakness`
      }
    }

    if (isYoYAnomaly) {
      const yoySign = yoyPct > 0 ? `+${yoyPct.toFixed(0)}%` : `${yoyPct.toFixed(0)}%`
      const yoyNote = `YoY ${yoyPct > 0 ? 'growth' : 'decline'}: ${yoySign} vs prior year`
      label = label ? `${label} · ${yoyNote}` : yoyNote
    }

    result.set(d.month, {
      direction: z >= 0 || (yoyPct ?? 0) > 0 ? 'spike' : 'dip',
      label,
    })
  }

  return result
}

// ── Custom dot — larger + coloured for anomaly months ────────────────────────
function makeDot(anomalies, baseColor) {
  return function AnomalyDot({ cx, cy, payload }) {
    if (!cx || !cy) return null
    const a = anomalies.get(payload?.month)
    if (!a) return <circle cx={cx} cy={cy} r={3} fill={baseColor} />
    const hi = a.direction === 'spike' ? '#f59e0b' : '#f43f5e'
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill={hi} fillOpacity={0.15} />
        <circle cx={cx} cy={cy} r={4.5} fill={hi} stroke="white" strokeWidth={1.5} />
      </g>
    )
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, anomalies }) {
  if (!active || !payload?.length) return null
  const a = anomalies.get(label)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs max-w-[260px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{p.value != null ? fmt(p.value) : '—'}</span>
        </div>
      ))}
      {a && (
        <p className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-amber-700 leading-relaxed">
          ⚠ {a.label}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrendChart({ monthlyData, prevYearMonthlyData = [], prevYear }) {
  const prevMap = useMemo(
    () => Object.fromEntries(prevYearMonthlyData.map(d => [d.month, d])),
    [prevYearMonthlyData],
  )

  // Merge current + prior-year into one array so Recharts aligns them on the same X axis
  const mergedData = useMemo(
    () => monthlyData.map(d => ({
      ...d,
      prevSales:  prevMap[d.month]?.sales  ?? null,
      prevMargin: prevMap[d.month]?.margin ?? null,
    })),
    [monthlyData, prevMap],
  )

  const allAnomalies = useMemo(() => detectAnomalies(monthlyData, prevMap), [monthlyData, prevMap])

  // Keep only the single biggest spike and single biggest dip
  const anomalies = useMemo(() => {
    const entries = [...allAnomalies.entries()]
    const spike = entries.filter(([, a]) => a.direction === 'spike')
                         .sort((x, y) => {
                           const zx = Math.abs(monthlyData.find(d => d.month === x[0])?.sales ?? 0)
                           const zy = Math.abs(monthlyData.find(d => d.month === y[0])?.sales ?? 0)
                           return zy - zx
                         })[0]
    const dip   = entries.filter(([, a]) => a.direction === 'dip')
                         .sort((x, y) => {
                           const zx = monthlyData.find(d => d.month === x[0])?.sales ?? 0
                           const zy = monthlyData.find(d => d.month === y[0])?.sales ?? 0
                           return zx - zy
                         })[0]
    const capped = new Map()
    if (spike) capped.set(spike[0], spike[1])
    if (dip)   capped.set(dip[0],   dip[1])
    return capped
  }, [allAnomalies, monthlyData])

  const anomalyMonths = useMemo(() => [...anomalies.keys()], [anomalies])
  const hasPrevYear  = prevYearMonthlyData.length > 0

  const salesDot  = useMemo(() => makeDot(anomalies, '#6366f1'), [anomalies])
  const marginDot = useMemo(() => makeDot(anomalies, '#10b981'), [anomalies])

  return (
    <div className="card px-5 py-4 flex flex-col gap-3 h-full">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Monthly Performance Trend</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Net Sales &amp; Margin
          {hasPrevYear && ` · Dashed = FY${prevYear}`}
          {anomalyMonths.length > 0 && ' · ⚠ Highlighted = anomalies'}
        </p>
      </div>

      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={mergedData} margin={{ top: 8, right: 16, bottom: 36, left: 8 }}>
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

            {/* Vertical highlight lines at anomaly months */}
            {anomalyMonths.map(month => (
              <ReferenceLine
                key={month}
                x={month}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                strokeOpacity={0.65}
              />
            ))}

            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false} axisLine={false} height={44}>
              <Label value="Month" offset={-6} position="insideBottom"
                style={{ fontSize: 10, fill: '#94a3b8' }} />
            </XAxis>

            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false}
              axisLine={false} tickFormatter={fmt} width={72}>
              <Label value="USD" angle={-90} position="insideLeft" offset={12}
                style={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'middle' }} />
            </YAxis>

            <Tooltip content={<CustomTooltip anomalies={anomalies} />} />
            <Legend wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => <span style={{ color: '#64748b' }}>{v}</span>} />

            {/* Prior-year dashed overlay */}
            {hasPrevYear && (
              <>
                <Line type="monotone" dataKey="prevSales"
                  name={`Sales FY${prevYear}`}
                  stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3"
                  strokeOpacity={0.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="prevMargin"
                  name={`Margin FY${prevYear}`}
                  stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3"
                  strokeOpacity={0.4} dot={false} connectNulls />
              </>
            )}

            {/* Current-year solid areas */}
            <Area type="monotone" dataKey="sales" name="Net Sales"
              stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGrad)"
              dot={salesDot} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="margin" name="Margin"
              stroke="#10b981" strokeWidth={2.5} fill="url(#marginGrad)"
              dot={marginDot} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Anomaly annotation panel */}
      {anomalyMonths.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Anomaly Insights
          </p>
          {[...anomalies.entries()].map(([month, a]) => (
            <div key={month} className="flex items-start gap-2 text-[10px] leading-relaxed">
              <span className={`mt-0.5 font-bold shrink-0 ${a.direction === 'spike' ? 'text-amber-600' : 'text-red-500'}`}>
                {a.direction === 'spike' ? '▲' : '▼'} {month}:
              </span>
              <span className="text-slate-600">{a.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
