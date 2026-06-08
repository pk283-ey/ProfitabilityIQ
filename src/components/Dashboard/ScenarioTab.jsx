import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, Legend, LabelList,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Lightbulb, RefreshCw,
  SlidersHorizontal, Filter, GitCompareArrows, Activity, DollarSign, Percent, Boxes,
} from 'lucide-react'
import {
  getScenarioOptions, getLatestActualsYear,
  computeBaseData, computeScenarioData,
  computeWaterfall, computeTrendData, generateInsights,
} from '../../lib/scenarioCalculator.js'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtM = (n) => {
  if (n == null || isNaN(n)) return '—'
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`
  return `${s}$${a.toFixed(0)}`
}
const fmtDelta = (n) => {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n), sign = n >= 0 ? '+' : '−'
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
const fmtDeltaPU = (n) => {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(4)}`
}
const fmtV   = (n) => n == null ? '—' : Math.round(n).toLocaleString()
const fmtPct = (n) => n == null ? '—' : `${n.toFixed(1)}%`
const fmtPU  = (n) => n == null ? '—' : `$${n.toFixed(4)}`

const SEL = 'text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer text-slate-700 w-full'

const DEFAULT_SLIDERS = {
  mrpChange: 0, volumeChange: 0, discount: 0,
  rmCostAdj: 0, pkgCostAdj: 0, ohCostAdj: 0, seasonality: 1,
}

const COLOR_BASE = '#3b82f6'   // blue
const COLOR_SCEN = '#f97316'   // orange
const COLOR_FCST = '#8b5cf6'   // violet

// ── Branded slider with filled track ──────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1, format }) {
  const display = format ? format(value) : `${value > 0 ? '+' : ''}${value}%`
  const pct     = ((value - min) / (max - min)) * 100
  const fill    = `linear-gradient(to right, #4f46e5 0%, #6366f1 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded
          ${value > 0 ? 'text-emerald-600 bg-emerald-50' : value < 0 ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
          {display}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="pi-range w-full" style={{ background: fill }}
      />
      <div className="flex justify-between text-[9px] text-slate-300 -mt-0.5">
        <span>{format ? format(min) : `${min}%`}</span>
        <span>{format ? format(max) : `${max}%`}</span>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, delta, isPositive, sub }) {
  const Tr    = isPositive == null ? Minus : isPositive ? TrendingUp : TrendingDown
  const color = isPositive == null ? 'text-slate-500 bg-slate-50 border-slate-200'
    : isPositive ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-red-600 bg-red-50 border-red-200'

  return (
    <div className="card px-5 py-4 flex flex-col gap-2.5 border-l-4 border-brand-500">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <Icon size={16} className="text-brand-500" />
      </div>
      <span className="text-2xl font-bold text-slate-800 leading-tight tabular-nums">{value}</span>
      <div className="flex items-center justify-between gap-2">
        {delta != null && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border px-1.5 py-0.5 rounded ${color}`}>
            <Tr size={11} />
            {delta}
          </span>
        )}
        {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}

// ── Card section header ───────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub, children }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-brand-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700 leading-tight">{title}</h3>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
const WaterfallTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload.find(p => p.dataKey === 'bar')?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.label}</p>
      <p className={d.isTotal ? 'text-brand-600 font-bold' : d.positive ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
        {d.isTotal ? fmtM(d.value) : fmtDelta(d.value)}
      </p>
      {!d.isTotal && <p className="text-[10px] text-slate-400 mt-0.5">Running: {fmtM(d.end)}</p>}
    </div>
  )
}

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => p.value != null && p.name?.trim())
  if (!rows.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {rows.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {fmtM(p.value)}</p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScenarioTab({ rawData }) {
  const options    = useMemo(() => getScenarioOptions(rawData),   [rawData])
  const latestYear = useMemo(() => getLatestActualsYear(rawData), [rawData])

  const [baseFilters, setBaseFilters] = useState(() => ({
    year: latestYear || 'All', sbu: 'All', therapyArea: 'All',
    productGroup: 'All', brandGroup: 'All', dosageForm: 'All', sku: 'All',
  }))
  const [sliders, setSliders]         = useState(DEFAULT_SLIDERS)
  const [forecastMonths, setForecast] = useState(3)

  const setSlider = (key) => (val) => setSliders(prev => ({ ...prev, [key]: val }))
  const setFilter = (key) => (val) => setBaseFilters(prev => ({ ...prev, [key]: val }))

  const base       = useMemo(() => computeBaseData(rawData, baseFilters),     [rawData, baseFilters])
  const scenario   = useMemo(() => computeScenarioData(base, sliders),         [base, sliders])
  const waterfall  = useMemo(() => computeWaterfall(base, scenario, sliders),  [base, scenario, sliders])
  const trend      = useMemo(() => computeTrendData(rawData, baseFilters, forecastMonths), [rawData, baseFilters, forecastMonths])
  const insightsData = useMemo(() => generateInsights(base, scenario, sliders), [base, scenario, sliders])

  const revChange = scenario.Sales     - base.Sales
  const mrgChange = scenario.Margin    - base.Margin
  const mrgPctChg = scenario.MarginPct - base.MarginPct
  const volChgPct = base.Volume > 0 ? (scenario.Volume - base.Volume) / base.Volume * 100 : 0

  // Waterfall chart rows
  const wfData = waterfall.map(s => ({
    ...s,
    fill: s.isTotal ? '#6366f1' : s.value >= 0 ? '#10b981' : '#ef4444',
  }))
  const dirty = JSON.stringify(sliders) !== JSON.stringify(DEFAULT_SLIDERS)

  // Trend combined + forecast bridge
  const ratio = base.Sales > 0 ? scenario.Sales / base.Sales : 1
  const trendCombined = useMemo(() => {
    const hist = trend.historical.map(h => ({
      month: h.month, baseSales: h.Sales, baseMargin: h.Margin,
      scenSales: Math.round(h.Sales * ratio), scenMargin: Math.round(h.Margin * ratio),
      projSales: null, projMargin: null, salesLow: null, salesHigh: null,
    }))
    const fcst = trend.forecast.map(f => ({
      month: f.month, baseSales: null, baseMargin: null, scenSales: null, scenMargin: null,
      projSales: f.projSales, projMargin: f.projMargin, salesLow: f.salesLow, salesHigh: f.salesHigh,
    }))
    // Bridge: seed forecast line + band at the last historical point
    if (hist.length) {
      const lp = hist[hist.length - 1]
      lp.projSales = lp.baseSales
      lp.projMargin = lp.baseMargin
      lp.salesLow = lp.baseSales
      lp.salesHigh = lp.baseSales
    }
    return [...hist, ...fcst]
  }, [trend, ratio])

  const lastHistMonth = trend.historical.length ? trend.historical[trend.historical.length - 1].month : null
  const noData = base.rowCount === 0

  // Shared filter list
  const FILTER_DEFS = [
    ['SBU',           'sbu',          options.sbus],
    ['Therapy Area',  'therapyArea',  options.therapyAreas],
    ['Product Group', 'productGroup', options.productGroups],
    ['Brand Group',   'brandGroup',   options.brandGroups],
    ['Dosage Form',   'dosageForm',   options.dosageForms],
    ['SKU',           'sku',          options.skus],
  ]

  return (
    <div className="flex flex-col gap-6">

      {noData && (
        <div className="card px-5 py-4 border-l-4 border-amber-400 text-xs text-amber-700">
          No Actuals data found for the selected filters. Adjust the filters in the left panel.
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label="Revenue Change" value={fmtM(scenario.Sales)}
          delta={fmtDelta(revChange)} isPositive={revChange >= 0} sub={`Base ${fmtM(base.Sales)}`} />
        <KPICard icon={TrendingUp} label="Margin Change" value={fmtM(scenario.Margin)}
          delta={fmtDelta(mrgChange)} isPositive={mrgChange >= 0} sub={`Base ${fmtM(base.Margin)}`} />
        <KPICard icon={Percent} label="Scenario Margin %" value={fmtPct(scenario.MarginPct)}
          delta={`${mrgPctChg >= 0 ? '+' : ''}${mrgPctChg.toFixed(1)} pts`} isPositive={mrgPctChg >= 0} sub={`Base ${fmtPct(base.MarginPct)}`} />
        <KPICard icon={Boxes} label="Volume Change %" value={fmtV(scenario.Volume)}
          delta={`${volChgPct >= 0 ? '+' : ''}${volChgPct.toFixed(1)}%`} isPositive={volChgPct >= 0} sub={`Base ${fmtV(base.Volume)}`} />
      </div>

      {/* ── Three-column body ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)_280px] gap-5 items-start">

        {/* LEFT — Controls */}
        <div className="card flex flex-col divide-y divide-slate-100">
          {/* Filters */}
          <div className="px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-brand-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Base Filters</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {FILTER_DEFS.map(([label, key, opts]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-slate-400">{label}</span>
                  <select value={baseFilters[key]} onChange={e => setFilter(key)(e.target.value)} className={SEL}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ))}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-slate-400">Fiscal Year</span>
                <select value={baseFilters.year} onChange={e => setFilter('year')(e.target.value)} className={SEL}>
                  {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Sliders */}
          <div className="px-4 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-brand-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">What-If Sliders</h3>
              </div>
              {dirty && (
                <button onClick={() => setSliders(DEFAULT_SLIDERS)}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-brand-600 transition-colors">
                  <RefreshCw size={11} /> Reset
                </button>
              )}
            </div>
            <Slider label="MRP Change %"       value={sliders.mrpChange}    onChange={setSlider('mrpChange')}    min={-50}  max={50} />
            <Slider label="Volume Change %"    value={sliders.volumeChange} onChange={setSlider('volumeChange')} min={-100} max={100} />
            <Slider label="Discount %"         value={sliders.discount}     onChange={setSlider('discount')}     min={0}    max={50} />
            <Slider label="RM Cost Adj %"      value={sliders.rmCostAdj}    onChange={setSlider('rmCostAdj')}    min={-30}  max={30} />
            <Slider label="Packaging Cost %"   value={sliders.pkgCostAdj}   onChange={setSlider('pkgCostAdj')}   min={-30}  max={30} />
            <Slider label="OH Cost Adj %"      value={sliders.ohCostAdj}    onChange={setSlider('ohCostAdj')}    min={-30}  max={30} />
            <Slider label="Seasonality Factor" value={sliders.seasonality}  onChange={setSlider('seasonality')}  min={0.5}  max={1.5} step={0.05} format={v => `×${v.toFixed(2)}`} />
          </div>
        </div>

        {/* CENTER — Table + Waterfall */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Base vs Scenario table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <SectionHead icon={GitCompareArrows} title="Base vs Scenario"
                sub="Per-unit and total metrics with change">
                <div className="flex items-center gap-3 text-[10px] font-semibold">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_BASE }} /> Base</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_SCEN }} /> Scenario</span>
                </div>
              </SectionHead>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLOR_BASE }}>Base</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLOR_SCEN }}>Scenario</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['PU Sales',       fmtPU(base.PUSales),   fmtPU(scenario.PUSales),   fmtDeltaPU(scenario.PUSales - base.PUSales),  scenario.PUSales >= base.PUSales, false],
                    ['Sales Volume',   fmtV(base.Volume),     fmtV(scenario.Volume),      `${volChgPct >= 0 ? '+' : ''}${volChgPct.toFixed(1)}%`, volChgPct >= 0, false],
                    ['Sales',          fmtM(base.Sales),      fmtM(scenario.Sales),       fmtDelta(revChange),  revChange >= 0, true],
                    ['PU Cost',        fmtPU(base.PUCost),    fmtPU(scenario.PUCost),     fmtDeltaPU(scenario.PUCost - base.PUCost),    scenario.PUCost <= base.PUCost, false],
                    ['RM Cost (PU)',   fmtPU(base.RMCost),    fmtPU(scenario.RMCost),     fmtDeltaPU(scenario.RMCost - base.RMCost),   scenario.RMCost <= base.RMCost, false],
                    ['Packaging (PU)', fmtPU(base.PkgCost),   fmtPU(scenario.PkgCost),    fmtDeltaPU(scenario.PkgCost - base.PkgCost), scenario.PkgCost <= base.PkgCost, false],
                    ['Other OH (PU)',  fmtPU(base.OtherOH),   fmtPU(scenario.OtherOH),    fmtDeltaPU(scenario.OtherOH - base.OtherOH), scenario.OtherOH <= base.OtherOH, false],
                    ['Margin',         fmtM(base.Margin),     fmtM(scenario.Margin),      fmtDelta(mrgChange),  mrgChange >= 0, true],
                    ['Margin %',       fmtPct(base.MarginPct),fmtPct(scenario.MarginPct), `${mrgPctChg >= 0 ? '+' : ''}${mrgPctChg.toFixed(1)} pts`, mrgPctChg >= 0, true],
                  ].map(([label, bv, sv, ch, pos, emph]) => (
                    <tr key={label} className={`border-b border-slate-50 hover:bg-slate-50/60 ${emph ? 'bg-slate-50/40' : ''}`}>
                      <td className={`px-5 py-2 text-slate-700 ${emph ? 'font-semibold' : 'font-medium'}`}>{label}</td>
                      <td className="px-5 py-2 text-right font-mono" style={{ color: COLOR_BASE }}>{bv}</td>
                      <td className="px-5 py-2 text-right font-mono" style={{ color: COLOR_SCEN }}>{sv}</td>
                      <td className={`px-5 py-2 text-right font-mono font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>{ch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Waterfall */}
          <div className="card px-5 py-4">
            <SectionHead icon={Activity} title="Margin Bridge"
              sub="How each lever moves Base Margin → Scenario Margin" />
            <div className="h-[300px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={wfData} margin={{ top: 24, right: 12, bottom: 44, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    angle={-22} textAnchor="end" interval={0} height={44} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={fmtM} width={56} />
                  <Tooltip content={<WaterfallTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="transparentBase" stackId="wf" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="bar" stackId="wf" radius={[3, 3, 0, 0]} maxBarSize={46}>
                    {wfData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.9} />)}
                    <LabelList dataKey="bar" content={(props) => {
                      const { x, y, width, index } = props
                      const d = wfData[index]
                      if (!d || (!d.isTotal && d.value === 0)) return null
                      const txt = d.isTotal ? fmtM(d.value) : fmtDelta(d.value)
                      return (
                        <text x={x + width / 2} y={y - 5} textAnchor="middle"
                          fontSize={9} fontWeight={600}
                          fill={d.isTotal ? '#6366f1' : d.positive ? '#059669' : '#dc2626'}>
                          {txt}
                        </text>
                      )
                    }} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-1 flex-wrap">
              {[['#6366f1','Total'], ['#10b981','Favourable'], ['#ef4444','Unfavourable']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c }} /> {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Insights */}
        <div className="card px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dynamic Insights</h3>
          </div>

          <div className="flex flex-col gap-2.5">
            {insightsData.insights.map((ins, i) => (
              <div key={i} className={`rounded-xl px-3 py-2.5 border text-xs leading-relaxed
                ${ins.type === 'positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : ins.type === 'negative' ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <span className={`inline-block text-[9px] font-bold uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded
                  ${ins.type === 'positive' ? 'bg-emerald-200 text-emerald-700'
                    : ins.type === 'negative' ? 'bg-red-200 text-red-700'
                    : 'bg-slate-200 text-slate-600'}`}>
                  {ins.badge}
                </span>
                {ins.text}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Impact Ranking</p>
            <div className="flex flex-col gap-2">
              {insightsData.drivers.slice(0, 6).map((d) => {
                const maxImp = Math.abs(insightsData.drivers[0]?.impact || 1)
                const pct    = maxImp > 0 ? Math.abs(d.impact) / maxImp * 100 : 0
                return (
                  <div key={d.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 capitalize">{d.label}</span>
                      <span className={`text-[10px] font-semibold tabular-nums ${d.impact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtDelta(d.impact)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${d.impact >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Trend & Forecast ──────────────────────────────────────────── */}
      <div className="card px-5 py-4">
        <SectionHead icon={Activity} title="Trend & Forecast"
          sub="Base (solid) · Scenario (dashed) · Forecast (dotted + confidence band)">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500">Forecast window</span>
            <input type="range" min={3} max={6} step={1} value={forecastMonths}
              onChange={e => setForecast(Number(e.target.value))}
              className="pi-range w-24"
              style={{ background: `linear-gradient(to right, #4f46e5 0%, #6366f1 ${(forecastMonths - 3) / 3 * 100}%, #e2e8f0 ${(forecastMonths - 3) / 3 * 100}%, #e2e8f0 100%)` }} />
            <span className="text-xs font-bold text-brand-600 w-16">{forecastMonths} months</span>
          </div>
        </SectionHead>

        <div className="h-[320px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendCombined} margin={{ top: 8, right: 24, bottom: 8, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={fmtM} width={56} />
              <Tooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="plainline" />
              {lastHistMonth && (
                <ReferenceLine x={lastHistMonth} stroke="#cbd5e1" strokeDasharray="4 3"
                  label={{ value: 'Forecast →', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }} />
              )}
              {/* Confidence band */}
              <Area dataKey="salesHigh" stackId="band" fill={COLOR_FCST} fillOpacity={0} stroke="none" name=" " legendType="none" connectNulls />
              <Area dataKey="salesHigh" fill={COLOR_FCST} fillOpacity={0.08} stroke="none" name=" " legendType="none" connectNulls />
              <Area dataKey="salesLow"  fill="#ffffff"    fillOpacity={1}    stroke="none" name=" " legendType="none" connectNulls />
              {/* Base */}
              <Line dataKey="baseSales"   name="Base Sales"      stroke={COLOR_BASE} strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="baseMargin"  name="Base Margin"     stroke={COLOR_BASE} strokeWidth={1.5} dot={false} connectNulls opacity={0.45} />
              {/* Scenario */}
              <Line dataKey="scenSales"   name="Scenario Sales"  stroke={COLOR_SCEN} strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls />
              <Line dataKey="scenMargin"  name="Scenario Margin" stroke={COLOR_SCEN} strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls opacity={0.5} />
              {/* Forecast */}
              <Line dataKey="projSales"   name="Forecast Sales"  stroke={COLOR_FCST} strokeWidth={2}   strokeDasharray="2 3" dot={false} connectNulls />
              <Line dataKey="projMargin"  name="Forecast Margin" stroke={COLOR_FCST} strokeWidth={1.25} strokeDasharray="2 3" dot={false} connectNulls opacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
