import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Zap, Target } from 'lucide-react'
import { computeExecutiveSummary } from '../../lib/dashboardAggregator.js'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDelta(n) {
  const abs  = Math.abs(n)
  const sign = n >= 0 ? '+' : '−'
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtPct(n, decimals = 1) {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(decimals)}%`
}
function fmtBps(n) {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(Math.round(n))} bps`
}
function trim(s, max = 28) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ── Single bullet row ─────────────────────────────────────────────────────────
function Bullet({ color, children }) {
  const dot = color === 'green' ? 'bg-emerald-500' : 'bg-red-500'
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span>{children}</span>
    </li>
  )
}

// ── Column (Tailwinds or Headwinds) ───────────────────────────────────────────
function Column({ title, icon: Icon, iconClass, borderClass, bgClass, children }) {
  return (
    <div className={`flex-1 rounded-xl border ${borderClass} ${bgClass} px-4 py-3 flex flex-col gap-2`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${iconClass}`}>
        <Icon size={13} />
        {title}
      </div>
      <ul className="flex flex-col gap-1.5">
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
    [rawData, filters.sbu, filters.year, filters.fiscalQuarter],
  )

  // ── No variance data available ────────────────────────────────────────────
  if (!data) {
    return (
      <div className="card px-5 py-4 border-l-4 border-brand-500 flex items-center gap-3">
        <Zap size={15} className="text-brand-500 shrink-0" />
        <p className="text-xs text-slate-500">
          Executive summary requires both <strong>Actuals</strong> and <strong>Budgeted</strong> data
          for the selected filters.
        </p>
      </div>
    )
  }

  const { tailwinds, headwinds, revenueDriver, totalPriceVar, totalVolVar, gapToBudget } = data
  const { pg1: twPG1, pg2: twPG2 } = tailwinds
  const { pg1: hwPG1, pg2: hwPG2 } = headwinds

  const hasTailwinds = !!(twPG1 || twPG2)
  const hasHeadwinds = !!(hwPG1 || hwPG2)

  // ── Revenue driver pill ───────────────────────────────────────────────────
  const driverLabel = revenueDriver === 'price-led' ? 'Price-led growth' : 'Volume-led growth'
  const driverColor = revenueDriver === 'price-led'
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-sky-50 text-sky-700 border-sky-200'

  // ── Gap to Budget pill ────────────────────────────────────────────────────
  const gapColor = !gapToBudget ? 'bg-slate-50 text-slate-500 border-slate-200'
    : gapToBudget.pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : gapToBudget.pct >= 85  ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200'

  return (
    <div className="card px-5 py-4 border-l-4 border-brand-500 flex flex-col gap-3">

      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">
            Executive Control Centre
          </span>
        </div>

        {/* Signal pills */}
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

      {/* ── Two-column body ───────────────────────────────────────────────── */}
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
              {twPG1 && (
                <Bullet color="green">
                  <strong>{trim(twPG1.name)}</strong> vs Budget:{' '}
                  {twPG1.priceVar > 0 && <>price variance <strong>{fmtDelta(twPG1.priceVar)}</strong></>}
                  {twPG1.priceVar > 0 && twPG1.mPctExpBps > 0 && ' · '}
                  {twPG1.mPctExpBps > 0 && <>margin expansion <strong>{fmtBps(twPG1.mPctExpBps)}</strong> vs Budget</>}
                </Bullet>
              )}
              {twPG2 && (
                <Bullet color="green">
                  <strong>{trim(twPG2.name)}</strong> vs Budget: volume growth{' '}
                  <strong>{fmtDelta(twPG2.volVar)}</strong>
                  {twPG2.volVarPct !== 0 && <> ({fmtPct(twPG2.volVarPct)} vs Budget)</>}
                </Bullet>
              )}
            </>
          ) : (
            <li className="text-xs text-emerald-600 italic">No significant value drivers vs Budget.</li>
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
              {hwPG1 && (
                <Bullet color="red">
                  <strong>{trim(hwPG1.name)}</strong> vs Budget: COGM cost overrun{' '}
                  <strong>{fmtDelta(hwPG1.cogmVar)}</strong>
                  {hwPG1.mPctExpBps < 0 && <> · margin compression <strong>{fmtBps(hwPG1.mPctExpBps)}</strong> vs Budget</>}
                </Bullet>
              )}
              {hwPG2 && (
                <Bullet color="red">
                  <strong>{trim(hwPG2.name)}</strong> vs Budget: volume shortfall{' '}
                  <strong>{fmtDelta(hwPG2.volVar)}</strong>
                  {hwPG2.volVarPct !== 0 && <> ({fmtPct(hwPG2.volVarPct)} vs Budget)</>}
                </Bullet>
              )}
            </>
          ) : (
            <li className="text-xs text-red-600 italic">No significant value eroders vs Budget.</li>
          )}
        </Column>

      </div>
    </div>
  )
}
