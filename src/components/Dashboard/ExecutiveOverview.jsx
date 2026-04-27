import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Zap, Target } from 'lucide-react'
import { computeExecutiveSummary } from '../../lib/dashboardAggregator.js'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtMoney(n) {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
function fmtDelta(n) {
  const abs  = Math.abs(n)
  const sign = n >= 0 ? '+' : '−'
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtVol(n) {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(0)
}
function trim(s, max = 26) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ── Single bullet row ─────────────────────────────────────────────────────────
function Bullet({ color, label, children }) {
  const dot = color === 'green' ? 'bg-emerald-500' : 'bg-red-500'
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1">{label} ·</span>}
        {children}
      </span>
    </li>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({ title, icon: Icon, iconClass, borderClass, bgClass, children }) {
  return (
    <div className={`flex-1 rounded-xl border ${borderClass} ${bgClass} px-4 py-3 flex flex-col gap-2`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${iconClass}`}>
        <Icon size={13} />
        {title}
      </div>
      <ul className="flex flex-col gap-2">
        {children}
      </ul>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExecutiveOverview({ rawData, filters }) {
  const data = useMemo(
    () => computeExecutiveSummary(rawData, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawData, filters.sbu, filters.year, filters.fiscalQuarter, filters.scenario],
  )

  if (!data) {
    const hint = filters.scenario === 'Actuals'
      ? 'YoY/QoQ comparison requires Actuals data for the selected period and its prior period.'
      : 'Executive summary requires both Actuals and Budgeted data for the selected filters.'
    return (
      <div className="card px-5 py-4 border-l-4 border-brand-500 flex items-center gap-3">
        <Zap size={15} className="text-brand-500 shrink-0" />
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    )
  }

  const {
    comparisonMode, comparisonLabel,
    tailwinds, headwinds,
    revenueDriver, totalPriceVar, totalVolVar,
    gapToBudget,
  } = data

  const { marginPG: twM, salesPG: twS, volumePG: twV } = tailwinds
  const { marginPG: hwM, salesPG: hwS, volumePG: hwV } = headwinds

  const hasTailwinds = !!(twM || twS || twV)
  const hasHeadwinds = !!(hwM || hwS || hwV)

  const driverLabel = revenueDriver === 'price-led' ? 'Price-led growth' : 'Volume-led growth'
  const driverColor = revenueDriver === 'price-led'
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-sky-50 text-sky-700 border-sky-200'

  const gapColor = !gapToBudget ? ''
    : gapToBudget.pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : gapToBudget.pct >= 85  ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200'

  const modeTag = comparisonMode === 'yoy' ? 'YoY Analysis'
    : comparisonMode === 'qoq' ? 'QoQ Analysis'
    : null

  return (
    <div className="card px-5 py-4 border-l-4 border-brand-500 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">
            Executive Control Centre
          </span>
          {modeTag && (
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {modeTag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${driverColor}`}>
            {driverLabel} &nbsp;·&nbsp; {fmtDelta(totalPriceVar)} price &nbsp;·&nbsp; {fmtDelta(totalVolVar)} vol
          </span>
          {gapToBudget && (
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${gapColor}`}>
              <Target size={11} />
              {gapToBudget.pct.toFixed(1)}% of Budget &nbsp;({gapToBudget.month})
              &nbsp;·&nbsp; {fmtDelta(gapToBudget.gap)}
            </span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* Value Drivers */}
        <Column
          title="Value Drivers"
          icon={TrendingUp}
          iconClass="text-emerald-700"
          borderClass="border-emerald-200"
          bgClass="bg-emerald-50/60"
        >
          {hasTailwinds ? (
            <>
              {twM && (
                <Bullet color="green" label="Margin %">
                  <strong>{trim(twM.name)}</strong> — highest margin {comparisonLabel}{' '}
                  (<strong>{twM.actMPct.toFixed(1)}%</strong> vs {twM.refMPct.toFixed(1)}%)
                </Bullet>
              )}
              {twS && (
                <Bullet color="green" label="Net Sales">
                  <strong>{trim(twS.name)}</strong> — highest sales {comparisonLabel}{' '}
                  (<strong>{fmtMoney(twS.actSales)}</strong> vs {fmtMoney(twS.refSales)})
                </Bullet>
              )}
              {twV && (
                <Bullet color="green" label="Volume">
                  <strong>{trim(twV.name)}</strong> — highest volume {comparisonLabel}{' '}
                  (<strong>{fmtVol(twV.actVol)}</strong> vs {fmtVol(twV.refVol)})
                </Bullet>
              )}
            </>
          ) : (
            <li className="text-xs text-emerald-600 italic">No value drivers for the selected period.</li>
          )}
        </Column>

        {/* Value Eroders */}
        <Column
          title="Value Eroders"
          icon={TrendingDown}
          iconClass="text-red-700"
          borderClass="border-red-200"
          bgClass="bg-red-50/60"
        >
          {hasHeadwinds ? (
            <>
              {hwM && (
                <Bullet color="red" label="Margin %">
                  <strong>{trim(hwM.name)}</strong> — lowest margin {comparisonLabel}{' '}
                  (<strong>{hwM.actMPct.toFixed(1)}%</strong> vs {hwM.refMPct.toFixed(1)}%)
                </Bullet>
              )}
              {hwS && (
                <Bullet color="red" label="Net Sales">
                  <strong>{trim(hwS.name)}</strong> — lowest sales {comparisonLabel}{' '}
                  (<strong>{fmtMoney(hwS.actSales)}</strong> vs {fmtMoney(hwS.refSales)})
                </Bullet>
              )}
              {hwV && (
                <Bullet color="red" label="Volume">
                  <strong>{trim(hwV.name)}</strong> — lowest volume {comparisonLabel}{' '}
                  (<strong>{fmtVol(hwV.actVol)}</strong> vs {fmtVol(hwV.refVol)})
                </Bullet>
              )}
            </>
          ) : (
            <li className="text-xs text-red-600 italic">No value eroders for the selected period.</li>
          )}
        </Column>

      </div>
    </div>
  )
}
