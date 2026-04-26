import { useState, useMemo } from 'react'
import { Sparkles, MessageSquare, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import FilterBar        from './FilterBar.jsx'
import KPICards         from './KPICards.jsx'
import ExecutiveOverview from './ExecutiveOverview.jsx'
import ComboChart       from './ComboChart.jsx'
import TrendChart       from './TrendChart.jsx'
import GaugeChart       from './GaugeChart.jsx'
import BubbleChart      from './BubbleChart.jsx'
import PieBreakdown     from './PieBreakdown.jsx'
import VarianceChart    from './VarianceChart.jsx'
import { filterData, computeDashboardData, getFilterOptions } from '../../lib/dashboardAggregator.js'

// Each pair of charts in the same row must have the same min height
// so cards stretch equally via items-stretch on the grid
const ROW_MIN_H = 'min-h-[420px]'

export default function Dashboard({ parsedData, onNavigateToChat, onBack }) {
  const { rawData, summary, fileName } = parsedData

  const [filters, setFilters] = useState(() => {
    const opts = getFilterOptions(rawData)
    const defaultYear = opts.years.includes('2026')
      ? '2026'
      : opts.years.length > 0 ? opts.years[opts.years.length - 1] : 'All'
    return {
      sbu:          'All',
      year:         defaultYear,
      scenario:     'Actuals',
      fiscalQuarter:'All',
    }
  })

  const options      = useMemo(() => getFilterOptions(rawData), [rawData])
  const filteredData = useMemo(() => filterData(rawData, filters), [rawData, filters])
  const dashData     = useMemo(() => computeDashboardData(filteredData, rawData, filters), [filteredData, rawData, filters])

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onBack} className="btn-ghost px-2 text-slate-400" title="Back to upload">
              <ArrowLeft size={16} />
            </button>
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800">Lupin ProfitIQ</span>
              <span className="ml-2 text-xs text-slate-400 hidden md:inline">Dashboard</span>
            </div>
          </div>

          <div className="w-px h-5 bg-slate-200 hidden md:block shrink-0" />

          <div className="flex-1 min-w-0">
            <FilterBar filters={filters} onChange={setFilters} options={options} />
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <FileSpreadsheet size={12} />
              <span className="max-w-[160px] truncate font-medium text-slate-600">{fileName}</span>
              <span>·</span>
              <span>{summary.rowCount.toLocaleString()} rows</span>
            </div>
            <button onClick={onNavigateToChat} className="btn-primary text-sm">
              <MessageSquare size={15} />
              Ask Fino
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Executive Overview (full width) */}
        <ExecutiveOverview rawData={rawData} filters={filters} />

        {/* KPI Cards (full width) */}
        <KPICards dashData={dashData} />

        {/* Row 1: Top-N Combo (3/5) + Monthly Trend (2/5) — equal stretch */}
        <div className={`grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch ${ROW_MIN_H}`}>
          <div className="xl:col-span-3 flex flex-col">
            {/* Pass filteredData so ComboChart can aggregate by any dimension */}
            <ComboChart filteredData={filteredData} />
          </div>
          <div className="xl:col-span-2 flex flex-col">
            <TrendChart
              monthlyData={dashData.monthlyData}
              prevYearMonthlyData={dashData.prevYearMonthlyData}
              prevYear={filters.year !== 'All' ? String(Number(filters.year) - 1) : null}
            />
          </div>
        </div>

        {/* Row 2: Budget Achievement (2/5) + Sales Pie (3/5) — equal stretch */}
        <div className={`grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch ${ROW_MIN_H}`}>
          <div className="xl:col-span-2 flex flex-col">
            <GaugeChart rawData={rawData} filters={filters} />
          </div>
          <div className="xl:col-span-3 flex flex-col">
            <PieBreakdown pie={dashData.pie} />
          </div>
        </div>

        {/* Row 3: Bubble (3/5) + Variance (2/5) — equal stretch */}
        <div className={`grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch ${ROW_MIN_H}`}>
          <div className="xl:col-span-3 flex flex-col">
            <BubbleChart bubble={dashData.bubble} />
          </div>
          <div className="xl:col-span-2 flex flex-col">
            <VarianceChart rawData={rawData} filters={filters} />
          </div>
        </div>

        <div className="h-8" />
      </main>
    </div>
  )
}
