import { useState, useMemo, useCallback, Fragment } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import {
  ChevronRight, ChevronDown, Plus, X, GripVertical,
  Settings2, Table2, BarChart3, Layers, Building2, ScanSearch,
} from 'lucide-react'
import {
  DEFAULT_HIERARCHY, DIM_LABELS,
  getExplorerOptions, buildHierarchyTree, flattenTree,
  buildVarianceTree, getVarianceChartData,
} from '../../lib/explorerAggregator.js'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtM = (n) => {
  if (n == null) return '—'
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`
  return `${s}$${a.toFixed(0)}`
}
const fmtV   = (n) => n == null ? '—' : Math.round(n).toLocaleString()
const fmtPct = (n) => n == null ? '—' : `${n.toFixed(1)}%`
const varColor = (n) => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-500' : 'text-slate-400'
const varBg    = (n) => n > 0 ? 'bg-emerald-50' : n < 0 ? 'bg-red-50' : 'bg-slate-50'

// Subtle accent palette for column groups (consistent with brand tokens)
const COL_ACCENTS = ['#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f43f5e','#0ea5e9']
const COL_TINTS   = ['bg-brand-50/30','bg-amber-50/30','bg-emerald-50/30','bg-pink-50/30','bg-blue-50/30','bg-violet-50/30','bg-teal-50/30','bg-rose-50/30','bg-sky-50/30']

const SEL = 'text-[11px] font-medium bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:border-brand-400 transition-all cursor-pointer text-slate-600 w-full'
const INDENT = 16

function newCol(id) {
  return { id, year: 'All', quarter: 'All', month: 'All', scenario: 'All' }
}

const colLabel = (col) => [
  col.year     !== 'All' ? `FY${col.year}` : null,
  col.quarter  !== 'All' ? col.quarter      : null,
  col.month    !== 'All' ? col.month         : null,
  col.scenario !== 'All' ? col.scenario      : null,
].filter(Boolean).join(' · ') || 'All Data'

// ── Sortable hierarchy chip (drag-to-reorder) ─────────────────────────────────
function SortableChip({ id, label, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-lg text-xs font-medium select-none transition-shadow
        ${isDragging
          ? 'bg-white border border-brand-300 shadow-lg z-50 text-brand-700'
          : 'bg-white border border-slate-200 text-slate-600 shadow-sm'}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-brand-500">
        <GripVertical size={13} />
      </span>
      <span className="w-4 h-4 rounded bg-slate-100 text-slate-400 text-[9px] font-bold flex items-center justify-center">{index + 1}</span>
      {label}
    </div>
  )
}

// ── Section header (consistent with overview cards) ──────────────────────────
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

// ── Comparison table row ──────────────────────────────────────────────────────
function TableRow({ node, expanded, onToggle, colCount }) {
  const indent = node.depth * INDENT
  const isLeaf = node.children.length === 0
  const labelCls = node.depth === 0 ? 'font-semibold text-slate-800'
    : node.depth === 1 ? 'font-medium text-slate-700' : 'text-slate-500'
  return (
    <tr className="group hover:bg-brand-50/20 border-b border-slate-50 transition-colors">
      <td className="sticky left-0 bg-white group-hover:bg-brand-50/20 z-10 px-3 py-2 min-w-[230px] max-w-[280px] transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}>
        <div className="flex items-center gap-1.5">
          {!isLeaf ? (
            <button onClick={() => onToggle(node.key)}
              className="text-slate-300 hover:text-brand-600 transition-colors shrink-0">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-3.5 shrink-0" />}
          <span className={`text-xs truncate ${labelCls}`} title={node.label}>{node.label || '—'}</span>
        </div>
      </td>
      {node.metrics.map((m, ci) => (
        <Fragment key={ci}>
          <td className={`text-right px-3 py-2 text-xs font-mono text-slate-700 whitespace-nowrap ${COL_TINTS[ci % COL_TINTS.length]}`}>{fmtM(m.Sales)}</td>
          <td className={`text-right px-3 py-2 text-xs font-mono font-medium whitespace-nowrap ${COL_TINTS[ci % COL_TINTS.length]}`}
              style={{ color: m.MarginPct >= 40 ? '#059669' : m.MarginPct >= 20 ? '#d97706' : m.MarginPct === 0 ? '#cbd5e1' : '#dc2626' }}>
            {fmtPct(m.MarginPct)}
          </td>
          <td className={`text-right px-3 py-2 text-xs font-mono text-slate-400 whitespace-nowrap ${COL_TINTS[ci % COL_TINTS.length]}`}>{fmtV(m.Volume)}</td>
        </Fragment>
      ))}
    </tr>
  )
}

// ── Variance row ──────────────────────────────────────────────────────────────
function VarRow({ node, expanded, onToggle }) {
  const indent = node.depth * INDENT
  const isLeaf = node.children.length === 0
  return (
    <tr className="group hover:bg-brand-50/20 border-b border-slate-50 transition-colors">
      <td className="sticky left-0 bg-white group-hover:bg-brand-50/20 z-10 px-3 py-2 min-w-[190px] transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}>
        <div className="flex items-center gap-1.5">
          {!isLeaf ? (
            <button onClick={() => onToggle(node.key)} className="text-slate-300 hover:text-brand-600">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-3.5" />}
          <span className={`text-xs truncate ${node.depth === 0 ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{node.label || '—'}</span>
        </div>
      </td>
      {[node.p1, node.p2, node.p3].map((v, i) => (
        <td key={i} className={`text-right px-3 py-2 text-xs font-mono text-slate-700 ${COL_TINTS[i % COL_TINTS.length]}`}>{fmtM(v)}</td>
      ))}
      {[node.v12, node.v23, node.v13].map((v, i) => (
        <td key={i} className="text-right px-2 py-2 text-xs font-mono font-semibold">
          <span className={`inline-block px-1.5 py-0.5 rounded ${varBg(v)} ${varColor(v)}`}>
            {v > 0 ? '+' : ''}{fmtM(v)}
          </span>
        </td>
      ))}
    </tr>
  )
}

const VarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1 truncate max-w-[180px]">{d?.name}</p>
      <p className={`font-bold ${d?.variance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {d?.variance >= 0 ? '+' : ''}{fmtM(d?.variance)}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExplorerTab({ rawData }) {
  const options = useMemo(() => getExplorerOptions(rawData), [rawData])

  const [sbu, setSbu] = useState('All')
  const [hierarchy, setHierarchy] = useState(DEFAULT_HIERARCHY)
  const [showHierarchyPanel, setShowHierarchyPanel] = useState(false)

  const [columns, setColumns] = useState([newCol(1), newCol(2)])
  const [expandedMain, setExpandedMain] = useState(new Set())

  const [p1, setP1] = useState(newCol('p1'))
  const [p2, setP2] = useState(newCol('p2'))
  const [p3, setP3] = useState(newCol('p3'))
  const [varMetric, setVarMetric]     = useState('Sales')
  const [varPair,   setVarPair]       = useState('P1-P2')
  const [varDim,    setVarDim]        = useState('Therapy Area')
  const [expandedVar, setExpandedVar] = useState(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const treeData = useMemo(() => buildHierarchyTree(rawData, sbu, columns, hierarchy), [rawData, sbu, columns, hierarchy])
  const flatRows = useMemo(() => flattenTree(treeData, expandedMain), [treeData, expandedMain])

  const varTree = useMemo(() => buildVarianceTree(rawData, sbu, [p1, p2, p3], hierarchy, varMetric), [rawData, sbu, p1, p2, p3, hierarchy, varMetric])
  const flatVarRows = useMemo(() => flattenTree(varTree, expandedVar), [varTree, expandedVar])

  const chartData = useMemo(() => getVarianceChartData(rawData, sbu, [p1, p2, p3], varDim, varPair, varMetric), [rawData, sbu, p1, p2, p3, varDim, varPair, varMetric])
  const chartHasVariance = chartData.some(d => d.variance !== 0)

  const toggleMain = useCallback((key) => setExpandedMain(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  }), [])
  const toggleVar = useCallback((key) => setExpandedVar(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  }), [])

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      setHierarchy(prev => arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)))
    }
  }
  const addColumn    = () => columns.length < 9 && setColumns(prev => [...prev, newCol(Date.now())])
  const removeColumn = (id) => setColumns(prev => prev.filter(c => c.id !== id))
  const updateColumn = (id, u) => setColumns(prev => prev.map(c => c.id === id ? { ...u, id } : c))

  const expandAll  = (tree, setter) => {
    const keys = new Set()
    const walk = (nodes) => nodes.forEach(n => { if (n.children.length) { keys.add(n.key); walk(n.children) } })
    walk(tree); setter(keys)
  }

  // Inline mini-select group used inside a column-group header
  const FilterGroup = ({ col, setter, accent }) => (
    <div className="grid grid-cols-2 gap-1 mt-1.5">
      <select value={col.year}     onChange={e => setter({ ...col, year:     e.target.value })} className={SEL}>
        {options.years.map(y => <option key={y} value={y}>{y === 'All' ? 'Year' : `FY${y}`}</option>)}
      </select>
      <select value={col.quarter}  onChange={e => setter({ ...col, quarter:  e.target.value })} className={SEL}>
        {options.quarters.map(q => <option key={q} value={q}>{q === 'All' ? 'Qtr' : q}</option>)}
      </select>
      <select value={col.month}    onChange={e => setter({ ...col, month:    e.target.value })} className={SEL}>
        {options.months.map(m => <option key={m} value={m}>{m === 'All' ? 'Month' : m}</option>)}
      </select>
      <select value={col.scenario} onChange={e => setter({ ...col, scenario: e.target.value })} className={SEL}>
        {options.scenarios.map(s => <option key={s} value={s}>{s === 'All' ? 'Scenario' : s}</option>)}
      </select>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="card px-5 py-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SBU</span>
            <select value={sbu} onChange={e => setSbu(e.target.value)}
              className="text-sm text-slate-700 font-medium bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer">
              {options.sbus.map(s => <option key={s} value={s}>{s === 'All' ? 'All SBUs' : s}</option>)}
            </select>
          </div>

          <div className="w-px h-5 bg-slate-200" />

          <button onClick={() => setShowHierarchyPanel(p => !p)}
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
              ${showHierarchyPanel ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
            <Settings2 size={13} />
            Reorder Hierarchy
            {showHierarchyPanel ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
            <Layers size={13} />
            {hierarchy.map(d => DIM_LABELS[d] || d).join(' → ')}
          </div>
        </div>

        {showHierarchyPanel && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold flex items-center gap-1">
              <GripVertical size={12} /> Drag to set drill-down order:
            </span>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={hierarchy} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-2 flex-wrap">
                  {hierarchy.map((dim, i) => (
                    <SortableChip key={dim} id={dim} label={DIM_LABELS[dim] || dim} index={i} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* ── Comparison Table ──────────────────────────────────────────────── */}
      <div className="card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <SectionHead icon={Table2} title="Dynamic Comparison Table"
            sub="Configure each period column below · expand rows to drill down the hierarchy">
            <div className="flex items-center gap-2">
              <button onClick={() => expandAll(treeData, setExpandedMain)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                Expand all
              </button>
              <button onClick={() => setExpandedMain(new Set())}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                Collapse
              </button>
              <button onClick={addColumn} disabled={columns.length >= 9}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Plus size={13} />
                Add Column {columns.length < 9 ? `(${columns.length}/9)` : '(max)'}
              </button>
            </div>
          </SectionHead>
        </div>

        <div className="overflow-auto max-h-[520px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              {/* Group header row — filters live here, aligned to their columns */}
              <tr>
                <th rowSpan={2} className="sticky left-0 bg-white z-30 text-left align-bottom px-3 py-2.5 border-b border-r border-slate-200 min-w-[230px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hierarchy</span>
                </th>
                {columns.map((col, ci) => (
                  <th key={col.id} colSpan={3}
                    className={`px-2.5 pt-2 pb-2 align-top border-b border-l border-slate-200 ${COL_TINTS[ci % COL_TINTS.length]}`}
                    style={{ borderTop: `2px solid ${COL_ACCENTS[ci % COL_ACCENTS.length]}`, minWidth: 240 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: COL_ACCENTS[ci % COL_ACCENTS.length] }}>
                        Col {ci + 1}
                      </span>
                      {columns.length > 1 && (
                        <button onClick={() => removeColumn(col.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate" title={colLabel(col)}>{colLabel(col)}</p>
                    <FilterGroup col={col} setter={u => updateColumn(col.id, u)} />
                  </th>
                ))}
              </tr>
              {/* Sub-header: metric labels */}
              <tr className="bg-slate-50">
                {columns.map((col, ci) => (
                  <Fragment key={col.id}>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-l border-slate-200">Sales</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Margin %</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Volume</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatRows.length === 0 ? (
                <tr><td colSpan={1 + columns.length * 3} className="text-center py-16 text-sm text-slate-400">
                  No data for the selected filters
                </td></tr>
              ) : flatRows.map(node => (
                <TableRow key={node.key} node={node} expanded={expandedMain.has(node.key)} onToggle={toggleMain} colCount={columns.length} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Variance Analysis ─────────────────────────────────────────────── */}
      <div className="card px-5 py-4 flex flex-col gap-4">
        <SectionHead icon={ScanSearch} title="Variance Analysis"
          sub="Compare up to 3 periods · P1−P2, P2−P3, P1−P3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {['Sales', 'Margin'].map(m => (
              <button key={m} onClick={() => setVarMetric(m)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all
                  ${varMetric === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {m}
              </button>
            ))}
          </div>
        </SectionHead>

        {/* Period config cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['P1', p1, setP1, 0], ['P2', p2, setP2, 1], ['P3', p3, setP3, 2]].map(([label, val, setter, ci]) => (
            <div key={label} className={`rounded-xl border border-slate-200 p-3 ${COL_TINTS[ci]}`}
              style={{ borderTop: `2px solid ${COL_ACCENTS[ci]}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COL_ACCENTS[ci] }}>{label}</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={colLabel(val)}>{colLabel(val)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select value={val.year}     onChange={e => setter(v => ({ ...v, year:     e.target.value }))} className={SEL}>
                  {options.years.map(y => <option key={y} value={y}>{y === 'All' ? 'Year' : `FY${y}`}</option>)}
                </select>
                <select value={val.quarter}  onChange={e => setter(v => ({ ...v, quarter:  e.target.value }))} className={SEL}>
                  {options.quarters.map(q => <option key={q} value={q}>{q === 'All' ? 'Qtr' : q}</option>)}
                </select>
                <select value={val.month}    onChange={e => setter(v => ({ ...v, month:    e.target.value }))} className={SEL}>
                  {options.months.map(m => <option key={m} value={m}>{m === 'All' ? 'Month' : m}</option>)}
                </select>
                <select value={val.scenario} onChange={e => setter(v => ({ ...v, scenario: e.target.value }))} className={SEL}>
                  {options.scenarios.map(s => <option key={s} value={s}>{s === 'All' ? 'Scenario' : s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Table + Chart */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Variance table */}
          <div className="flex-1 border border-slate-100 rounded-xl overflow-hidden">
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 bg-slate-50 z-20 text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 min-w-[190px]">Hierarchy</th>
                    {['P1','P2','P3'].map((l, i) => (
                      <th key={l} className={`text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide border-b border-slate-200 whitespace-nowrap ${COL_TINTS[i]}`}
                        style={{ color: COL_ACCENTS[i] }}>{l}</th>
                    ))}
                    {['P1−P2','P2−P3','P1−P3'].map(l => (
                      <th key={l} className="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-l border-slate-200 whitespace-nowrap">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flatVarRows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-slate-400">No data</td></tr>
                  ) : flatVarRows.map(node => (
                    <VarRow key={node.key} node={node} expanded={expandedVar.has(node.key)} onToggle={toggleVar} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance chart */}
          <div className="xl:w-[440px] shrink-0 flex flex-col gap-2.5 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <BarChart3 size={14} className="text-brand-500" />
                Top movers by {DIM_LABELS[varDim] || varDim}
              </div>
              <div className="flex items-center gap-1.5">
                <select value={varDim} onChange={e => setVarDim(e.target.value)} className={SEL + ' !w-auto'}>
                  {DEFAULT_HIERARCHY.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
                </select>
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  {['P1-P2','P2-P3','P1-P3'].map(p => (
                    <button key={p} onClick={() => setVarPair(p)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all
                        ${varPair === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[340px]">
              {chartHasVariance ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={108}
                      tickFormatter={(v) => v.length > 16 ? v.slice(0, 15) + '…' : v} />
                    <Tooltip content={<VarTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1} />
                    <Bar dataKey="variance" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.variance >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <span className="text-2xl">⚖️</span>
                  <p className="text-sm font-medium text-slate-500">No variance to show</p>
                  <p className="text-xs text-slate-400 max-w-[220px]">
                    The selected periods produce identical values. Change P1, P2 or P3 above to compare different periods.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
