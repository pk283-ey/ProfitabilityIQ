// ─────────────────────────────────────────────────────────────────────────────
// Explorer Aggregator
// Powers the Sales & Margin Explorer tab
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

export const DEFAULT_HIERARCHY = ['Divison','Therapy Area','Product Group','Brand Group','Dosage Form','SKU Desc']

export const DIM_LABELS = {
  'Divison':       'Division',
  'Therapy Area':  'Therapy Area',
  'Product Group': 'Product Group',
  'Brand Group':   'Brand Group',
  'Dosage Form':   'Dosage Form',
  'SKU Desc':      'SKU',
}

// ── Filter option lists ───────────────────────────────────────────────────────
export function getExplorerOptions(rawData) {
  const uniq = (key) =>
    [...new Set(rawData.map(r => r[key]).filter(v => v != null && v !== ''))].map(String).sort()
  const fiscalYears = [...new Set(
    rawData.map(r => String(r['FiscalYear'] ?? r['Year'] ?? '')).filter(Boolean)
  )].sort()

  return {
    sbus:      ['All', ...uniq('Reported SBU')],
    years:     ['All', ...fiscalYears],
    quarters:  ['All', ...['FQ1','FQ2','FQ3','FQ4'].filter(q => rawData.some(r => r.FiscalQuarter === q))],
    months:    ['All', ...MONTH_ORDER.filter(m => rawData.some(r => r.MonthName === m))],
    scenarios: ['All', ...uniq('Scenario')],
  }
}

// ── Row-level filter for a single column config ───────────────────────────────
export function filterForColumn(rawData, sbuFilter, col) {
  return rawData.filter(row => {
    if (sbuFilter && sbuFilter !== 'All' && row['Reported SBU'] !== sbuFilter) return false
    const yr = String(row['FiscalYear'] ?? row['Year'] ?? '')
    if (col.year     && col.year     !== 'All' && yr              !== String(col.year))     return false
    if (col.quarter  && col.quarter  !== 'All' && row.FiscalQuarter !== col.quarter)         return false
    if (col.month    && col.month    !== 'All' && row.MonthName     !== col.month)           return false
    if (col.scenario && col.scenario !== 'All' && row.Scenario      !== col.scenario)        return false
    return true
  })
}

// ── Build aggregation maps (depth × pathKey → {Sales,Margin,Volume}) ─────────
function buildColMap(rows, hierarchyOrder) {
  const maps = {}
  for (let d = 0; d < hierarchyOrder.length; d++) maps[d] = {}

  for (const row of rows) {
    const parts = []
    for (let d = 0; d < hierarchyOrder.length; d++) {
      parts.push(String(row[hierarchyOrder[d]] ?? 'Unknown'))
      const key = parts.join('|||')
      if (!maps[d][key]) maps[d][key] = { Sales: 0, Margin: 0, Volume: 0 }
      maps[d][key].Sales  += Number(row.Sales)              || 0
      maps[d][key].Margin += Number(row.Margin)             || 0
      maps[d][key].Volume += Number(row['Sales Volume'])    || 0
    }
  }
  return maps
}

// ── Build nested tree for the comparison table ────────────────────────────────
// Each node: { key, depth, label, metrics:[{Sales,Margin,MarginPct,Volume},...], children:[] }
export function buildHierarchyTree(rawData, sbuFilter, filterColumns, hierarchyOrder) {
  const colMaps = filterColumns.map(col =>
    buildColMap(filterForColumn(rawData, sbuFilter, col), hierarchyOrder)
  )

  // All unique keys per depth (union across columns)
  const allKeysPerDepth = hierarchyOrder.map((_, d) => {
    const s = new Set()
    colMaps.forEach(cm => Object.keys(cm[d] || {}).forEach(k => s.add(k)))
    return [...s]
  })

  function buildLevel(depth, parentKey) {
    let keys = allKeysPerDepth[depth] || []
    if (depth === 0) {
      keys = keys.filter(k => !k.includes('|||'))
    } else {
      keys = keys.filter(k => {
        const parts = k.split('|||')
        return parts.slice(0, depth).join('|||') === parentKey
      })
    }

    // Sort by first column Sales desc
    keys.sort((a, b) =>
      (colMaps[0]?.[depth]?.[b]?.Sales || 0) - (colMaps[0]?.[depth]?.[a]?.Sales || 0)
    )

    return keys.map(key => {
      const label   = key.split('|||')[depth]
      const metrics = filterColumns.map((_, ci) => {
        const agg = colMaps[ci]?.[depth]?.[key] || { Sales: 0, Margin: 0, Volume: 0 }
        return {
          Sales:     Math.round(agg.Sales),
          Margin:    Math.round(agg.Margin),
          Volume:    Math.round(agg.Volume),
          MarginPct: agg.Sales > 0 ? agg.Margin / agg.Sales * 100 : 0,
        }
      })
      const children = depth < hierarchyOrder.length - 1
        ? buildLevel(depth + 1, key)
        : []
      return { key, depth, label, metrics, children }
    })
  }

  return buildLevel(0, null)
}

// ── Flatten tree for rendering (honoring expandedSet) ────────────────────────
export function flattenTree(nodes, expandedSet, result = []) {
  for (const node of nodes) {
    result.push(node)
    if (node.children.length > 0 && expandedSet.has(node.key)) {
      flattenTree(node.children, expandedSet, result)
    }
  }
  return result
}

// ── Variance section tree ─────────────────────────────────────────────────────
export function buildVarianceTree(rawData, sbuFilter, configs, hierarchyOrder, metric) {
  const colMaps = configs.map(col =>
    buildColMap(filterForColumn(rawData, sbuFilter, col), hierarchyOrder)
  )

  const allKeysPerDepth = hierarchyOrder.map((_, d) => {
    const s = new Set()
    colMaps.forEach(cm => Object.keys(cm[d] || {}).forEach(k => s.add(k)))
    return [...s]
  })

  const getValue = (ci, depth, key) => {
    const agg = colMaps[ci]?.[depth]?.[key] || { Sales: 0, Margin: 0 }
    return metric === 'Sales' ? Math.round(agg.Sales) : Math.round(agg.Margin)
  }

  function buildLevel(depth, parentKey) {
    let keys = allKeysPerDepth[depth] || []
    if (depth === 0) {
      keys = keys.filter(k => !k.includes('|||'))
    } else {
      keys = keys.filter(k => k.split('|||').slice(0, depth).join('|||') === parentKey)
    }
    keys.sort((a, b) => getValue(0, depth, b) - getValue(0, depth, a))

    return keys.map(key => {
      const label = key.split('|||')[depth]
      const p1 = getValue(0, depth, key)
      const p2 = getValue(1, depth, key)
      const p3 = getValue(2, depth, key)
      const children = depth < hierarchyOrder.length - 1 ? buildLevel(depth + 1, key) : []
      return { key, depth, label, p1, p2, p3, v12: p1 - p2, v23: p2 - p3, v13: p1 - p3, children }
    })
  }

  return buildLevel(0, null)
}

// ── Variance chart data (by a single dimension) ───────────────────────────────
export function getVarianceChartData(rawData, sbuFilter, configs, dimension, variancePair, metric) {
  const colData = configs.map(col => {
    const rows = filterForColumn(rawData, sbuFilter, col)
    const map = {}
    for (const row of rows) {
      const k = String(row[dimension] ?? 'Unknown')
      if (!map[k]) map[k] = { Sales: 0, Margin: 0 }
      map[k].Sales  += Number(row.Sales)  || 0
      map[k].Margin += Number(row.Margin) || 0
    }
    return map
  })

  const allKeys = [...new Set(colData.flatMap(m => Object.keys(m)))]
  return allKeys
    .map(key => {
      const vals = colData.map(m => {
        const v = m[key] || { Sales: 0, Margin: 0 }
        return metric === 'Sales' ? Math.round(v.Sales) : Math.round(v.Margin)
      })
      const [p1, p2, p3] = vals
      const variance =
        variancePair === 'P1-P2' ? p1 - p2 :
        variancePair === 'P2-P3' ? p2 - p3 : p1 - p3
      return { name: key, variance, p1, p2, p3 }
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 15)
}
