// ─────────────────────────────────────────────────────────────────────────────
// Variance Calculator
// Phase 1: Unit-level rate derivation
// Phase 2: Sales Variance (Price + Volume)
// Phase 3: Margin Variance (Price + Cost + Volume)
// ─────────────────────────────────────────────────────────────────────────────

const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)

function groupBy(arr, key) {
  const map = {}
  for (const row of arr) {
    const k = row[key] ?? 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

// ── Phase 1: Derive unit metrics for a set of rows ────────────────────────────
function unitMetrics(rows) {
  const sales  = sum(rows, 'Sales')
  const volume = sum(rows, 'Sales Volume')
  const cogm   = sum(rows, 'COGM')
  const margin = sum(rows, 'Margin')
  return {
    sales, volume, cogm, margin,
    unitPrice:  volume > 0 ? sales  / volume : 0,   // ASP = Sales / Volume
    unitCost:   volume > 0 ? cogm   / volume : 0,   // Cost = COGM / Volume
    unitMargin: volume > 0 ? margin / volume : 0,   // Unit Margin = Margin / Volume
    marginPct:  sales  > 0 ? margin / sales  * 100 : 0,
  }
}

// ── Phase 2 & 3: Variance formulas for one entity (Actual vs Budget) ──────────
function computeEntityVariance(actualRows, budgetRows, name) {
  const a = unitMetrics(actualRows)
  const b = unitMetrics(budgetRows)

  // Phase 2 — Sales Variance
  const priceVariance  = (a.unitPrice - b.unitPrice) * a.volume   // Revenue impact of price change
  const volumeVariance = (a.volume   - b.volume)    * b.unitPrice  // Revenue impact of volume change
  const totalSalesVar  = priceVariance + volumeVariance

  // Phase 3 — Margin Variance
  const marginPriceVariance  = priceVariance                         // = Sales price variance (goes to profit directly)
  const marginCostVariance   = (b.unitCost  - a.unitCost)  * a.volume // Favourable when actual cost < budget cost
  const marginVolumeVariance = (a.volume    - b.volume)    * b.unitMargin // Profit impact of volume swing
  const totalMarginVar       = marginPriceVariance + marginCostVariance + marginVolumeVariance

  return {
    name,
    actual:  a,
    budget:  b,
    priceVariance,
    volumeVariance,
    totalSalesVariance:    totalSalesVar,
    marginPriceVariance,
    marginCostVariance,
    marginVolumeVariance,
    totalMarginVariance:   totalMarginVar,
    isFavourable: totalSalesVar >= 0,
  }
}

// ── Main: compute variance by a grouping dimension ────────────────────────────
// Always compares Actuals vs Budget (scenario filter bypassed)
export function computeVarianceByDimension(rawData, filters, dimension = 'Therapy Area') {
  // Apply all filters EXCEPT scenario
  const base = rawData.filter(row => {
    if (filters.sbu !== 'All'          && row['SBU']          !== filters.sbu)          return false
    if (filters.year !== 'All'         && String(row['Year']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']!== filters.fiscalQuarter) return false
    return true
  })

  const actualData = base.filter(r => r.Scenario === 'Actuals')
  const budgetData = base.filter(r => r.Scenario === 'Budgeted')

  const actualGroups = groupBy(actualData, dimension)
  const budgetGroups = groupBy(budgetData, dimension)

  const allDimValues = [...new Set([
    ...Object.keys(actualGroups),
    ...Object.keys(budgetGroups),
  ])]

  const results = allDimValues
    .map(dim => computeEntityVariance(
      actualGroups[dim] || [],
      budgetGroups[dim] || [],
      dim,
    ))
    .filter(r => Math.abs(r.totalSalesVariance) > 0 || Math.abs(r.totalMarginVariance) > 0)
    .sort((a, b) => Math.abs(b.totalSalesVariance) - Math.abs(a.totalSalesVariance))

  // Roll up totals
  const totals = computeEntityVariance(actualData, budgetData, 'TOTAL')

  return { results, totals, dimension }
}

// ── Format variance for AI chat context ──────────────────────────────────────
export function buildVarianceContext(rawData, filters) {
  const byTherapy = computeVarianceByDimension(rawData, filters, 'Therapy Area')
  const fmt = (n) => {
    const sign = n >= 0 ? '+' : ''
    if (Math.abs(n) >= 1e6) return `${sign}$${(n/1e6).toFixed(1)}M`
    if (Math.abs(n) >= 1e3) return `${sign}$${(n/1e3).toFixed(1)}K`
    return `${sign}$${n.toFixed(0)}`
  }

  const lines = [
    '=== VARIANCE ANALYSIS (Actuals vs Budget) ===',
    `TOTAL: Sales Var ${fmt(byTherapy.totals.totalSalesVariance)} | Price Var ${fmt(byTherapy.totals.priceVariance)} | Volume Var ${fmt(byTherapy.totals.volumeVariance)}`,
    `       Margin Var ${fmt(byTherapy.totals.totalMarginVariance)} | Cost Var ${fmt(byTherapy.totals.marginCostVariance)}`,
    '',
    'BY THERAPY AREA (top 8):',
    ...byTherapy.results.slice(0, 8).map(r =>
      `  ${r.name}: SalesVar ${fmt(r.totalSalesVariance)} [Price ${fmt(r.priceVariance)} | Vol ${fmt(r.volumeVariance)}] | MarginVar ${fmt(r.totalMarginVariance)}`
    ),
    '',
    'FORMULAS USED:',
    '  Price Variance = (Actual Unit Price − Budget Unit Price) × Actual Volume',
    '  Volume Variance = (Actual Volume − Budget Volume) × Budget Unit Price',
    '  Margin Cost Variance = (Budget Unit Cost − Actual Unit Cost) × Actual Volume',
    '  Margin Volume Variance = (Actual Volume − Budget Volume) × Budget Unit Margin',
  ]
  return lines.join('\n')
}
