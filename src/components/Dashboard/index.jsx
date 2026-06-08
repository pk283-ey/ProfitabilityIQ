import { useState, useMemo } from 'react'
import { Sparkles, MessageSquare, ArrowLeft, FileSpreadsheet, LayoutDashboard, Table2, FlaskConical } from 'lucide-react'
import FilterBar         from './FilterBar.jsx'
import KPICards          from './KPICards.jsx'
import ExecutiveOverview from './ExecutiveOverview.jsx'
import ComboChart        from './ComboChart.jsx'
import TrendChart        from './TrendChart.jsx'
import GaugeChart        from './GaugeChart.jsx'
import BubbleChart       from './BubbleChart.jsx'
import PieBreakdown      from './PieBreakdown.jsx'
import ExplorerTab       from './ExplorerTab.jsx'
import ScenarioTab       from './ScenarioTab.jsx'
import { filterData, computeDashboardData, getFilterOptions } from '../../lib/dashboardAggregator.js'

const ROW_MIN_H = 'min-h-[420px]'

const TABS = [
  { id: 'overview', label: 'Overview',               icon: LayoutDashboard },
  { id: 'explorer', label: 'Sales & Margin Explorer', icon: Table2          },
  { id: 'scenario', label: 'Scenario Model',          icon: FlaskConical    },
]

export default function Dashboard({ parsedData, onNavigateToChat, onBack }) {
  const { rawData, summary, fileName } = parsedData

  const [activeTab, setActiveTab] = useState('overview')

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

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6">

          {/* Row 1: Logo · Tabs · Actions */}
          <div className="flex items-center gap-4 py-3">

            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={onBack} className="btn-ghost px-2 text-slate-400" title="Back to upload">
                <ArrowLeft size={16} />
              </button>
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <Sparkles size={13} className="text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800">Lupin ProfitIQ</span>
            </div>

            <div className="w-px h-5 bg-slate-200 hidden md:block shrink-0" />

            {/* Tabs */}
            <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
              {TABS.map(tab => {
                const Icon    = tab.icon
                const active  = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all
                      ${active
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {/* Right actions */}
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

          {/* Row 2: FilterBar — only on Overview tab */}
          {activeTab === 'overview' && (
            <div className="pb-3 border-t border-slate-100 pt-3">
              <FilterBar filters={filters} onChange={setFilters} options={options} />
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            <ExecutiveOverview rawData={rawData} filters={filters} />
            <KPICards dashData={dashData} />

            <div className={`grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch ${ROW_MIN_H}`}>
              <div className="xl:col-span-3 flex flex-col">
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

            <div className={`grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch ${ROW_MIN_H}`}>
              <div className="xl:col-span-2 flex flex-col">
                <GaugeChart rawData={rawData} filters={filters} />
              </div>
              <div className="xl:col-span-3 flex flex-col">
                <PieBreakdown pie={dashData.pie} />
              </div>
            </div>

            <div className="h-[480px]">
              <BubbleChart bubble={dashData.bubble} />
            </div>

            <div className="h-8" />
          </>
        )}

        {/* ── EXPLORER TAB ─────────────────────────────────────────────── */}
        {activeTab === 'explorer' && (
          <ExplorerTab rawData={rawData} />
        )}

        {/* ── SCENARIO TAB ─────────────────────────────────────────────── */}
        {activeTab === 'scenario' && (
          <ScenarioTab rawData={rawData} />
        )}

      </main>
    </div>
  )
}
