import { TrendingUp, DollarSign, Package, Layers, Database, BarChart2 } from 'lucide-react'

const CARDS = (s) => [
  {
    label:  'Total Rows',
    value:  s.rowCount.toLocaleString(),
    sub:    `${s.columnCount} columns`,
    icon:   <Database size={18} />,
    color:  'text-brand-600 bg-brand-50',
  },
  {
    label:  'Total Sales',
    value:  s.totalSalesFmt,
    sub:    'All scenarios · FY' + s.fiscalYears.join('/'),
    icon:   <DollarSign size={18} />,
    color:  'text-emerald-600 bg-emerald-50',
  },
  {
    label:  'Total Margin',
    value:  s.totalMarginFmt,
    sub:    `${s.marginPercent}% margin rate`,
    icon:   <TrendingUp size={18} />,
    color:  'text-indigo-600 bg-indigo-50',
  },
  {
    label:  'Total COGM',
    value:  s.totalCOGMFmt,
    sub:    'Cost of goods manufactured',
    icon:   <BarChart2 size={18} />,
    color:  'text-amber-600 bg-amber-50',
  },
  {
    label:  'Products',
    value:  s.uniqueProductCount.toLocaleString(),
    sub:    `${s.uniqueSKUCount} unique SKUs`,
    icon:   <Package size={18} />,
    color:  'text-violet-600 bg-violet-50',
  },
  {
    label:  'Therapy Areas',
    value:  s.uniqueTherapyCount.toLocaleString(),
    sub:    s.therapyAreas.slice(0, 3).join(', ') + (s.therapyAreas.length > 3 ? '…' : ''),
    icon:   <Layers size={18} />,
    color:  'text-sky-600 bg-sky-50',
  },
]

export default function MetricCards({ summary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {CARDS(summary).map((c, i) => (
        <div key={i} className="card px-5 py-4 flex flex-col gap-3 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>
            {c.icon}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800 leading-tight">{c.value}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{c.label}</div>
            <div className="text-[11px] text-slate-400 mt-1 leading-tight">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
