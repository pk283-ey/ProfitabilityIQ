import { DollarSign, TrendingUp, Percent } from 'lucide-react'

const MEDALS = ['🥇', '🥈', '🥉']

function fmt(n) {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

// ── RAG comparison badge ──────────────────────────────────────────────────────
function ComparisonBadge({ current, previous, label }) {
  if (previous == null || previous === 0) return null
  const delta    = current - previous
  const deltaPct = (delta / Math.abs(previous)) * 100
  const absP     = Math.abs(deltaPct)
  const isUp     = delta >= 0

  const color = absP < 0.5
    ? 'text-amber-600 bg-amber-50 border-amber-200'
    : isUp
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-red-600 bg-red-50 border-red-200'

  const arrow = isUp ? '▲' : '▼'
  const sign  = isUp ? '+' : ''

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold
      px-1.5 py-0.5 rounded border ${color} leading-none`}>
      {arrow} {sign}{deltaPct.toFixed(1)}% {label}
    </span>
  )
}

// ── KPI metric card ───────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, yoyVal, yoyPrev, yoyLabel, momVal, momPrev, momLabel }) {
  return (
    <div className="card px-5 py-4 flex flex-col gap-3 border-l-4 border-brand-500">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
      {/* Comparison badges */}
      <div className="flex flex-wrap gap-1.5">
        <ComparisonBadge current={yoyVal}  previous={yoyPrev}  label={yoyLabel  || 'YoY'} />
        <ComparisonBadge current={momVal}  previous={momPrev}  label={momLabel  || 'MoM'} />
      </div>
    </div>
  )
}

// ── Rank card (therapy / product) ─────────────────────────────────────────────
function RankCard({ label, items }) {
  return (
    <div className="card px-5 py-4 flex flex-col gap-3">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex flex-col gap-2">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-base leading-none">{MEDALS[i]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-700 truncate">{item.name}</div>
              <div className="text-[11px] text-slate-400">{fmt(item.sales)}</div>
            </div>
            {/* Mini bar */}
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-400"
                style={{ width: `${(item.sales / (items[0]?.sales || 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function KPICards({ dashData }) {
  const { kpis, prevYearKpis, prevMonthKpis, therapyRanked, productRanked } = dashData

  const yoyLabel = prevYearKpis ? `vs FY${prevYearKpis.year}` : 'YoY'
  const momLabel = prevMonthKpis ? `vs ${prevMonthKpis.month}` : 'MoM'

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

      {/* Net Sales */}
      <MetricCard
        label="Net Sales"
        value={fmt(kpis.totalSales)}
        sub={`Volume: ${kpis.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} units`}
        icon={<DollarSign size={16} className="text-brand-500" />}
        yoyVal={kpis.totalSales}   yoyPrev={prevYearKpis?.totalSales}   yoyLabel={yoyLabel}
        momVal={kpis.totalSales}   momPrev={prevMonthKpis?.totalSales}   momLabel={momLabel}
      />

      {/* Gross Margin */}
      <MetricCard
        label="Gross Margin"
        value={fmt(kpis.totalMargin)}
        sub={`COGM: ${fmt(kpis.totalCOGM)}`}
        icon={<TrendingUp size={16} className="text-brand-500" />}
        yoyVal={kpis.totalMargin}  yoyPrev={prevYearKpis?.totalMargin}  yoyLabel={yoyLabel}
        momVal={kpis.totalMargin}  momPrev={prevMonthKpis?.totalMargin}  momLabel={momLabel}
      />

      {/* Margin % */}
      <MetricCard
        label="Margin %"
        value={`${kpis.marginPct.toFixed(1)}%`}
        sub="Margin / Net Sales"
        icon={<Percent size={16} className="text-brand-500" />}
        yoyVal={kpis.marginPct}    yoyPrev={prevYearKpis?.marginPct}    yoyLabel={yoyLabel}
        momVal={kpis.marginPct}    momPrev={prevMonthKpis?.marginPct}    momLabel={momLabel}
      />

      <RankCard label="Top 3 Therapy Areas"  items={therapyRanked} />
      <RankCard label="Top 3 Product Groups" items={productRanked} />
    </div>
  )
}
