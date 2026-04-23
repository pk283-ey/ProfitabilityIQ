// ─────────────────────────────────────────────────────────────────────────────
// Data Aggregator
// Converts natural-language queries into compact, accurate data context
// that gets sent to the AI — instead of raw 27K+ rows.
// ─────────────────────────────────────────────────────────────────────────────

const sum  = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)

function groupBy(arr, keys) {
  const map = {}
  for (const row of arr) {
    const k = keys.map(k => row[k] ?? 'Unknown').join('|||')
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

function aggregate(rows, groupKeys) {
  const s = sum(rows, 'Sales')
  const c = sum(rows, 'COGM')
  const m = sum(rows, 'Margin')
  const v = sum(rows, 'Sales Volume')
  const obj = {}
  groupKeys.forEach(k => { obj[k] = rows[0][k] ?? 'Unknown' })
  obj.Sales        = Math.round(s)
  obj.COGM         = Math.round(c)
  obj.Margin       = Math.round(m)
  obj['Sales Volume'] = Math.round(v)
  obj['Margin%']   = s !== 0 ? ((m / s) * 100).toFixed(1) + '%' : '—'
  obj.Rows         = rows.length
  return obj
}

// ── Intent detection helpers ─────────────────────────────────────────────────
function detectDimensions(q) {
  const dims = []
  if (/therapy\s*area|therapy/i.test(q))                          dims.push('Therapy Area')
  if (/product\s*group|product|sku|drug|brand/i.test(q))          dims.push('Product Group')
  if (/division|divison/i.test(q))                                dims.push('Divison')
  if (/quarter|fq/i.test(q))                                      dims.push('FiscalQuarter')
  if (/month|monthly/i.test(q))                                   dims.push('MonthName')
  if (/scenario/i.test(q))                                        dims.push('Scenario')
  if (/manufactur/i.test(q))                                      dims.push('Manufacturing Source')
  if (/channel/i.test(q))                                         dims.push('Sales Channel')
  if (/year|annual|fy/i.test(q))                                  dims.push('FiscalYear')
  if (/npl|inline|launch/i.test(q))                               dims.push('NPL/Inline')
  return dims
}

function detectScenarioFilter(q) {
  const hasActuals  = /\bactuals?\b/i.test(q)
  const hasBudget   = /\bbudget(ed)?\b/i.test(q)
  const hasLE       = /\blatest\s*estimate\b|\ble\b/i.test(q)
  const mentioned   = [hasActuals, hasBudget, hasLE].filter(Boolean).length

  // If more than one scenario is mentioned (e.g. "Actuals vs Budgeted"), send all scenarios
  if (mentioned > 1) return null
  if (hasActuals)    return 'Actuals'
  if (hasBudget)     return 'Budgeted'
  if (hasLE)         return 'Latest Estimate'
  return null
}

function detectQuarterFilter(q) {
  const m = q.match(/\b(fq[1-4]|q[1-4])\b/i)
  if (!m) return null
  return m[1].toUpperCase().replace(/^Q/, 'FQ')
}

function detectProductFilter(q, productGroups) {
  const ql = q.toLowerCase()
  return productGroups.find(p => ql.includes(p.toLowerCase())) || null
}

function detectTherapyFilter(q, therapyAreas) {
  const ql = q.toLowerCase()
  return therapyAreas.find(t => ql.includes(t.toLowerCase())) || null
}

// ── Main context builder ─────────────────────────────────────────────────────
export function buildContext(query, rawData, summary) {
  let data = [...rawData]

  // Apply filters
  const scenarioFilter = detectScenarioFilter(query)
  if (scenarioFilter) data = data.filter(r => r.Scenario === scenarioFilter)

  const quarterFilter = detectQuarterFilter(query)
  if (quarterFilter) data = data.filter(r => r.FiscalQuarter === quarterFilter)

  const therapyFilter = detectTherapyFilter(query, summary.therapyAreas)
  if (therapyFilter) data = data.filter(r => r['Therapy Area'] === therapyFilter)

  const productFilter = detectProductFilter(query, summary.productGroups)
  if (productFilter) data = data.filter(r => r['Product Group'] === productFilter)

  // Detect grouping dimensions
  const dims = detectDimensions(query)

  // For forecast/trend queries, return monthly series by scenario
  if (/forecast|trend|project|over\s*time|monthly|growth/i.test(query)) {
    const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
    const grouped = groupBy(data, ['MonthName', 'Scenario'])
    const series = Object.entries(grouped).map(([key, rows]) => {
      const [month, scenario] = key.split('|||')
      return {
        Month: month,
        MonthOrder: MONTH_ORDER.indexOf(month),
        Scenario: scenario,
        Sales: Math.round(sum(rows, 'Sales')),
        Margin: Math.round(sum(rows, 'Margin')),
        COGM: Math.round(sum(rows, 'COGM')),
        'Sales Volume': Math.round(sum(rows, 'Sales Volume')),
      }
    }).sort((a, b) => a.MonthOrder - b.MonthOrder || a.Scenario.localeCompare(b.Scenario))
    return JSON.stringify({ type: 'timeseries', data: series }, null, 2)
  }

  // For top-N queries
  const topMatch = query.match(/top\s*(\d+)/i)
  const topN = topMatch ? parseInt(topMatch[1]) : null

  // Aggregate by detected dimensions
  // Always include Scenario in grouping so Actuals / Budgeted / LE are never merged
  if (dims.length > 0) {
    const groupDims = scenarioFilter ? dims : [...new Set([...dims, 'Scenario'])]
    const grouped = groupBy(data, groupDims)
    let rows = Object.values(grouped)
      .map(rows => aggregate(rows, groupDims))
      .sort((a, b) => b.Sales - a.Sales)
    if (topN) rows = rows.slice(0, topN)
    else rows = rows.slice(0, 50)
    return JSON.stringify({ type: 'aggregated', groupBy: groupDims, filters: { scenario: scenarioFilter, quarter: quarterFilter, therapy: therapyFilter, product: productFilter }, data: rows }, null, 2)
  }

  // Default: always split by Scenario so numbers are never blended across Actuals / Budget / LE
  if (!scenarioFilter) {
    const byScen = groupBy(data, ['Scenario'])
    const scenRows = Object.entries(byScen).map(([, rows]) => aggregate(rows, ['Scenario']))
    return JSON.stringify({
      type: 'scenario_comparison',
      filters: { quarter: quarterFilter, therapy: therapyFilter, product: productFilter },
      note: 'Each row is one Scenario — do NOT sum these rows together. Compare them side by side.',
      data: scenRows,
    }, null, 2)
  }

  // Single-scenario totals
  const total = aggregate(data, [])
  delete total['']
  return JSON.stringify({
    type: 'summary',
    filters: { scenario: scenarioFilter, quarter: quarterFilter, therapy: therapyFilter, product: productFilter },
    totals: total,
    byTherapyArea: summary.byTherapyArea.slice(0, 15),
  }, null, 2)
}
