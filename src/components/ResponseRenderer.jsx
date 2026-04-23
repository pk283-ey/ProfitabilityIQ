import { useEffect, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#6366f1','#f59e0b','#8b5cf6','#10b981',
  '#0ea5e9','#f43f5e','#14b8a6','#f97316',
  '#84cc16','#ec4899',
]
const SCENARIO_COLOR = { Actuals: '#6366f1', Budgeted: '#f59e0b', 'Latest Estimate': '#8b5cf6' }
const FORECAST_COLOR = '#10b981'

// ── Number formatting ─────────────────────────────────────────────────────────
function fmtNum(v) {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return v
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

function TextResponse({ data }) {
  return (
    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
      {data.insight && <p className="font-medium text-slate-800 mb-2">{data.insight}</p>}
      {data.content}
    </div>
  )
}

function TableResponse({ data }) {
  const { title, insight, headers = [], rows = [] } = data
  return (
    <div className="flex flex-col gap-3">
      {title && <p className="text-sm font-semibold text-slate-700">{title}</p>}
      {insight && <p className="text-xs text-slate-500 leading-relaxed">{insight}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="data-table">
          <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChartResponse({ data }) {
  const { chartType, title, insight, labels = [], datasets = [] } = data

  const chartData = labels.map((label, i) => {
    const obj = { label }
    datasets.forEach(ds => { obj[ds.name] = ds.values?.[i] ?? null })
    return obj
  })

  const CHART_H = 280

  const axisProps = {
    tick: { fontSize: 11, fill: '#94a3b8' },
    tickLine: false,
    axisLine: false,
  }

  const renderDatasets = (Type) => datasets.map((ds, i) => (
    <Type
      key={ds.name}
      type="monotone"
      dataKey={ds.name}
      stroke={SCENARIO_COLOR[ds.name] || PALETTE[i % PALETTE.length]}
      fill={SCENARIO_COLOR[ds.name] || PALETTE[i % PALETTE.length]}
      fillOpacity={0.15}
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4 }}
      isAnimationActive={true}
    />
  ))

  const renderBars = () => datasets.map((ds, i) => (
    <Bar
      key={ds.name}
      dataKey={ds.name}
      fill={SCENARIO_COLOR[ds.name] || PALETTE[i % PALETTE.length]}
      radius={[4, 4, 0, 0]}
      maxBarSize={48}
    />
  ))

  return (
    <div className="flex flex-col gap-3">
      {title && <p className="text-sm font-semibold text-slate-700">{title}</p>}
      {insight && <p className="text-xs text-slate-500 leading-relaxed">{insight}</p>}

      <div style={{ height: CHART_H }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={labels.map((label, i) => ({ name: label, value: datasets[0]?.values?.[i] ?? 0 }))}
                cx="50%" cy="50%" outerRadius={100}
                dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {labels.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtNum(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={72} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {renderDatasets(Line)}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={72} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {renderDatasets(Area)}
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              barCategoryGap={chartType === 'stacked_bar' ? '30%' : '20%'}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={72} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {datasets.map((ds, i) => (
                <Bar
                  key={ds.name}
                  dataKey={ds.name}
                  fill={SCENARIO_COLOR[ds.name] || PALETTE[i % PALETTE.length]}
                  stackId={chartType === 'stacked_bar' ? 'stack' : undefined}
                  radius={chartType === 'stacked_bar' ? [0,0,0,0] : [4,4,0,0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CardsResponse({ data }) {
  const { title, cards = [] } = data
  const TrendIcon = { up: TrendingUp, down: TrendingDown, neutral: Minus }
  const trendColor = { up: 'text-emerald-600', down: 'text-red-500', neutral: 'text-slate-400' }

  return (
    <div className="flex flex-col gap-3">
      {title && <p className="text-sm font-semibold text-slate-700">{title}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c, i) => {
          const Icon = TrendIcon[c.trend] || Minus
          const color = trendColor[c.trend] || 'text-slate-400'
          return (
            <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-500 font-medium leading-tight">{c.label}</p>
                <Icon size={14} className={color} />
              </div>
              <p className="text-xl font-bold text-slate-800 mt-2">{c.value}</p>
              {c.sub && <p className="text-xs text-slate-400 mt-1">{c.sub}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ForecastResponse({ data }) {
  const { title, insight, labels = [], actuals = [], budget = [], le = [], projected = [] } = data

  const chartData = labels.map((m, i) => ({
    label: m,
    Actuals:          actuals[i]   ?? undefined,
    Budget:           budget[i]    ?? undefined,
    'Latest Estimate':le[i]        ?? undefined,
    Forecast:         projected[i] ?? undefined,
  }))

  const axisProps = { tick: { fontSize: 11, fill: '#94a3b8' }, tickLine: false, axisLine: false }

  return (
    <div className="flex flex-col gap-3">
      {title && <p className="text-sm font-semibold text-slate-700">{title}</p>}
      {insight && <p className="text-xs text-slate-500 leading-relaxed">{insight}</p>}
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtNum} width={72} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Actuals"           stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="Budget"            stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="Latest Estimate"   stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
            <Line type="monotone" dataKey="Forecast"          stroke="#10b981" strokeWidth={2} strokeDasharray="3 2" dot={{ r: 3, fill: '#10b981' }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {[['Actuals','#6366f1','solid'],['Budget','#f59e0b','dashed'],['Latest Estimate','#8b5cf6','dashed'],['Forecast','#10b981','dotted']].map(([n,c,s]) => (
          <div key={n} className="flex items-center gap-1.5">
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={c} strokeWidth="2" strokeDasharray={s==='dashed'?'5,3':s==='dotted'?'2,2':''} /></svg>
            <span className="text-slate-500">{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HtmlResponse({ data }) {
  const iframeRef = useRef()

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
    doc.open()
    doc.write(data.html || '')
    doc.close()
  }, [data.html])

  return (
    <div className="flex flex-col gap-3">
      {data.title  && <p className="text-sm font-semibold text-slate-700">{data.title}</p>}
      {data.insight && <p className="text-xs text-slate-500 leading-relaxed">{data.insight}</p>}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        className="w-full rounded-xl border border-slate-200 bg-white"
        style={{ height: 420, minHeight: 320 }}
        title={data.title || 'Chart'}
      />
    </div>
  )
}

// ── Main router ───────────────────────────────────────────────────────────────
export default function ResponseRenderer({ response }) {
  if (!response) return null

  const { type } = response

  if (type === 'multi' && Array.isArray(response.components)) {
    return (
      <div className="flex flex-col gap-6">
        {response.components.map((c, i) => <ResponseRenderer key={i} response={c} />)}
      </div>
    )
  }

  const wrap = (children) => <div className="w-full">{children}</div>

  if (type === 'text')     return wrap(<TextResponse     data={response} />)
  if (type === 'table')    return wrap(<TableResponse    data={response} />)
  if (type === 'chart')    return wrap(<ChartResponse    data={response} />)
  if (type === 'cards')    return wrap(<CardsResponse    data={response} />)
  if (type === 'forecast') return wrap(<ForecastResponse data={response} />)
  if (type === 'html')     return wrap(<HtmlResponse     data={response} />)

  // Fallback: pretty-print JSON
  return wrap(
    <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 overflow-x-auto">
      {JSON.stringify(response, null, 2)}
    </pre>
  )
}
