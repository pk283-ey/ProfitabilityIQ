import { Filter } from 'lucide-react'

const Select = ({ label, value, onChange, options, allLabel = 'All' }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm text-slate-700 font-medium bg-white border border-slate-200 rounded-lg px-3 py-1.5
        focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer"
    >
      <option value="All">{allLabel}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
)

export default function FilterBar({ filters, onChange, options }) {
  const set = (key) => (val) => onChange({ ...filters, [key]: val })

  return (
    <div className="flex items-end gap-5 flex-wrap">
      <div className="flex items-center gap-2 text-slate-400 self-end pb-2">
        <Filter size={14} />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
      </div>

      <Select
        label="SBU"
        value={filters.sbu}
        onChange={set('sbu')}
        options={options.sbus}
        allLabel="All SBUs"
      />
      <Select
        label="Fiscal Year"
        value={filters.year}
        onChange={set('year')}
        options={options.years}
        allLabel="All Years"
      />
      <Select
        label="Scenario"
        value={filters.scenario}
        onChange={set('scenario')}
        options={options.scenarios}
        allLabel="All Scenarios"
      />
      <Select
        label="Fiscal Quarter"
        value={filters.fiscalQuarter}
        onChange={set('fiscalQuarter')}
        options={options.quarters}
        allLabel="All Quarters"
      />
    </div>
  )
}
