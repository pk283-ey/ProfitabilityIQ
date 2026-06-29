// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Aggregator — all data transformations for the dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { dimVal } from './dataCube.js'

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

const sum  = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)

function groupBy(arr, key) {
  const map = {}
  for (const row of arr) {
    const k = dimVal(row[key])
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

// ── Filter raw data by current filter selections ──────────────────────────────
export function filterData(rawData, filters) {
  return rawData.filter(row => {
    if (filters.sbu !== 'All'          && row['SBU']               !== filters.sbu)          return false
    if (filters.year !== 'All'         && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.scenario !== 'All'     && row['Scenario']           !== filters.scenario)      return false
    if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']      !== filters.fiscalQuarter) return false
    return true
  })
}

// ── Get distinct filter options from rawData ──────────────────────────────────
export function getFilterOptions(rawData) {
  const uniq = (key) => [...new Set(rawData.map(r => r[key]).filter(Boolean))].sort()
  return {
    sbus:    uniq('SBU'),
    years:   [...new Set(rawData.map(r => r['FiscalYear']).filter(Boolean))].map(String).sort(),
    scenarios: ['Actuals', 'Budgeted', 'Latest Estimate'].filter(s =>
      rawData.some(r => r['Scenario'] === s)
    ),
    quarters: ['FQ1','FQ2','FQ3','FQ4'].filter(q =>
      rawData.some(r => r['FiscalQuarter'] === q)
    ),
  }
}

// ── Main dashboard computation ────────────────────────────────────────────────
export function computeDashboardData(filteredData, rawData, filters) {

  // ─ KPIs ─────────────────────────────────────────────────────────────────────
  const totalSales  = sum(filteredData, 'Sales')
  const totalMargin = sum(filteredData, 'Margin')
  const totalCOGM   = sum(filteredData, 'COGM')
  const totalVolume = sum(filteredData, 'Sales Volume')
  const marginPct   = totalSales > 0 ? (totalMargin / totalSales * 100) : 0

  // ─ Top 3 Therapy Area ────────────────────────────────────────────────────────
  const therapyRanked = Object.entries(groupBy(filteredData, 'Therapy Area'))
    .map(([name, rows]) => ({
      name,
      sales: sum(rows, 'Sales'),
      margin: sum(rows, 'Margin'),
      marginPct: sum(rows, 'Sales') > 0
        ? (sum(rows, 'Margin') / sum(rows, 'Sales') * 100) : 0,
    }))
    .sort((a, b) => b.sales - a.sales)

  // ─ Top 3 Product Group ───────────────────────────────────────────────────────
  const productRanked = Object.entries(groupBy(filteredData, 'Product Group'))
    .map(([name, rows]) => ({
      name,
      sales: sum(rows, 'Sales'),
      margin: sum(rows, 'Margin'),
    }))
    .sort((a, b) => b.sales - a.sales)

  // ─ Dosage Form combo chart (Top & Bottom 8) ──────────────────────────────────
  const dosageData = Object.entries(groupBy(filteredData, 'Dosage Form'))
    .map(([name, rows]) => {
      const s = sum(rows, 'Sales')
      const m = sum(rows, 'Margin')
      return { name, sales: s, margin: m, marginPct: s > 0 ? m / s * 100 : 0 }
    })
    .sort((a, b) => b.sales - a.sales)

  // ─ Monthly trend (respects all active filters) ───────────────────────────────
  const monthlyByName = groupBy(filteredData, 'MonthName')
  const monthlyData = MONTH_ORDER
    .filter(m => monthlyByName[m])
    .map(month => {
      const rows = monthlyByName[month]
      return {
        month,
        sales:  sum(rows, 'Sales'),
        margin: sum(rows, 'Margin'),
        volume: sum(rows, 'Sales Volume'),
      }
    })

  // ─ Gauge — auto-detect latest Actuals month, then compare all 3 scenarios ────
  //   Always apply SBU + FiscalYear + Quarter filters but ignore Scenario filter
  const nonScenarioData = rawData.filter(row => {
    if (filters.sbu !== 'All'          && row['SBU']               !== filters.sbu)          return false
    if (filters.year !== 'All'         && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']      !== filters.fiscalQuarter) return false
    return true
  })

  const actualsMonths = nonScenarioData
    .filter(r => r.Scenario === 'Actuals')
    .map(r => r.MonthName)
    .filter(Boolean)
  const latestMonth = MONTH_ORDER.filter(m => actualsMonths.includes(m)).pop() || null

  let gaugeData = null
  if (latestMonth) {
    const monthRows = nonScenarioData.filter(r => r.MonthName === latestMonth)
    const actSales = sum(monthRows.filter(r => r.Scenario === 'Actuals'),         'Sales')
    const budSales = sum(monthRows.filter(r => r.Scenario === 'Budgeted'),        'Sales')
    const leSales  = sum(monthRows.filter(r => r.Scenario === 'Latest Estimate'), 'Sales')
    gaugeData = {
      month: latestMonth,
      actuals:    actSales,
      budget:     budSales,
      le:         leSales,
      actualsPct: budSales > 0 ? actSales / budSales * 100 : 0,
      lePct:      budSales > 0 ? leSales  / budSales * 100 : 0,
    }
  }

  // ─ Bubble chart aggregations ─────────────────────────────────────────────────
  function bubbleAgg(groupKey) {
    return Object.entries(groupBy(filteredData, groupKey))
      .map(([name, rows]) => {
        const s = sum(rows, 'Sales')
        const m = sum(rows, 'Margin')
        const v = sum(rows, 'Sales Volume')
        return { name, x: s, y: s > 0 ? m / s * 100 : 0, z: v }
      })
      .filter(d => d.x > 0)
      .sort((a, b) => b.x - a.x)
  }

  const bubbleByTherapy  = bubbleAgg('Therapy Area')
  const bubbleByProduct  = bubbleAgg('Product Group')
  const bubbleByDivision = bubbleAgg('Divison')

  // ─ Pie chart aggregations ────────────────────────────────────────────────────
  function pieAgg(groupKey) {
    const total = totalSales || 1
    return Object.entries(groupBy(filteredData, groupKey))
      .map(([name, rows]) => ({ name, value: sum(rows, 'Sales'), pct: sum(rows, 'Sales') / total * 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }

  const pieByTherapy  = pieAgg('Therapy Area')
  const pieByProduct  = pieAgg('Product Group')
  const pieByDivision = pieAgg('Divison')

  // ─ Prev year monthly data — for YoY overlay on trend chart ─────────────────
  let prevYearMonthlyData = []
  if (filters.year !== 'All') {
    const prevYr = String(Number(filters.year) - 1)
    const pyRows = rawData.filter(row => {
      if (filters.sbu          !== 'All' && row['SBU']               !== filters.sbu)          return false
      if (String(row['FiscalYear'])       !== prevYr)                                           return false
      if (filters.scenario     !== 'All' && row['Scenario']           !== filters.scenario)      return false
      if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']      !== filters.fiscalQuarter) return false
      return true
    })
    const pyByMonth = groupBy(pyRows, 'MonthName')
    prevYearMonthlyData = MONTH_ORDER
      .filter(m => pyByMonth[m])
      .map(month => ({
        month,
        sales:  sum(pyByMonth[month], 'Sales'),
        margin: sum(pyByMonth[month], 'Margin'),
        volume: sum(pyByMonth[month], 'Sales Volume'),
      }))
  }

  // ─ YoY comparison — previous fiscal year, same scenario/SBU/quarter ────────
  let prevYearKpis = null
  if (filters.year !== 'All') {
    const prevYear = String(Number(filters.year) - 1)
    const prevYearData = rawData.filter(row => {
      if (filters.sbu !== 'All'          && row['SBU']               !== filters.sbu)          return false
      if (String(row['FiscalYear'])      !== prevYear)                                          return false
      if (filters.scenario !== 'All'     && row['Scenario']           !== filters.scenario)      return false
      if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']      !== filters.fiscalQuarter) return false
      return true
    })
    if (prevYearData.length > 0) {
      const pySales  = sum(prevYearData, 'Sales')
      const pyMargin = sum(prevYearData, 'Margin')
      prevYearKpis = {
        totalSales:  pySales,
        totalMargin: pyMargin,
        marginPct:   pySales > 0 ? (pyMargin / pySales * 100) : 0,
        year:        prevYear,
      }
    }
  }

  // ─ MoM comparison — previous month in the current filtered dataset ──────────
  let prevMonthKpis = null
  const presentMonths = MONTH_ORDER.filter(m => monthlyByName[m])
  if (presentMonths.length >= 2) {
    const prevMonth     = presentMonths[presentMonths.length - 2]
    const prevMonthRows = monthlyByName[prevMonth] || []
    const pmSales  = sum(prevMonthRows, 'Sales')
    const pmMargin = sum(prevMonthRows, 'Margin')
    prevMonthKpis = {
      totalSales:  pmSales,
      totalMargin: pmMargin,
      marginPct:   pmSales > 0 ? (pmMargin / pmSales * 100) : 0,
      month:       prevMonth,
    }
  }

  return {
    kpis: { totalSales, totalMargin, totalCOGM, totalVolume, marginPct },
    prevYearKpis,
    prevMonthKpis,
    prevYearMonthlyData,
    therapyRanked,
    productRanked,
    dosageData,
    monthlyData,
    gaugeData,
    bubble: { therapy: bubbleByTherapy, product: bubbleByProduct, division: bubbleByDivision },
    pie:    { therapy: pieByTherapy,    product: pieByProduct,    division: pieByDivision },
  }
}

// ── Executive Summary — shared helpers ───────────────────────────────────────

function _aggBy(rows, dim) {
  const map = {}
  for (const row of rows) {
    const k = dimVal(row[dim])
    if (!map[k]) map[k] = { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
    map[k].Sales  += Number(row['Sales'])        || 0
    map[k].Volume += Number(row['Sales Volume']) || 0
    map[k].COGM   += Number(row['COGM'])         || 0
    map[k].Margin += Number(row['Margin'])       || 0
  }
  return map
}

// Build per-PG comparison metrics — only PGs with non-zero Sales in BOTH periods
function _buildPGMetrics(curRows, refRows) {
  const curByPG = _aggBy(curRows, 'Product Group')
  const refByPG = _aggBy(refRows, 'Product Group')
  const keys = [...new Set([...Object.keys(curByPG), ...Object.keys(refByPG)])]
  return keys.map(k => {
    const c = curByPG[k] || { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
    const r = refByPG[k] || { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
    if (!(c.Sales > 0 && r.Sales > 0)) return null   // must be non-zero in both
    const actMPct    = c.Sales > 0 ? c.Margin / c.Sales * 100 : 0
    const refMPct    = r.Sales > 0 ? r.Margin / r.Sales * 100 : 0
    const mGrowthBps = (actMPct - refMPct) * 100
    const volGrowth  = c.Volume - r.Volume
    const salesGrowth = c.Sales - r.Sales
    return {
      name: k,
      actMPct, refMPct,
      mGrowthBps,
      mGrowthPpt:    actMPct - refMPct,
      actMargin:     c.Margin,  refMargin:  r.Margin,
      actVol:        c.Volume,  refVol:     r.Volume,
      volGrowth,
      volGrowthPct:  r.Volume > 0 ? volGrowth / r.Volume * 100 : 0,
      actSales:      c.Sales,   refSales:   r.Sales,
      salesGrowth,
      salesGrowthPct: r.Sales > 0 ? salesGrowth / r.Sales * 100 : 0,
    }
  }).filter(Boolean)
}

// Pick top 3 drivers + top 3 eroders — one per metric (margin%, net sales, volume)
// Each category independently selects the best/worst PG; the same PG can appear in multiple.
function _selectLeaders(pgMetrics) {
  if (!pgMetrics.length) {
    const empty = { marginPG: null, salesPG: null, volumePG: null }
    return { tailwinds: empty, headwinds: { ...empty } }
  }

  // Sort once per dimension
  const byMargin = [...pgMetrics].sort((a, b) => (b.actMPct - b.refMPct) - (a.actMPct - a.refMPct))
  const bySales  = [...pgMetrics].sort((a, b) => b.salesGrowth - a.salesGrowth)
  const byVol    = [...pgMetrics].sort((a, b) => b.volGrowth   - a.volGrowth)

  return {
    tailwinds: {
      marginPG: byMargin[0]                        || null,  // highest margin % vs reference
      salesPG:  bySales[0]                         || null,  // highest net sales vs reference
      volumePG: byVol[0]                           || null,  // highest volume vs reference
    },
    headwinds: {
      marginPG: byMargin[byMargin.length - 1]      || null,  // lowest margin % vs reference
      salesPG:  bySales[bySales.length - 1]        || null,  // lowest net sales vs reference
      volumePG: byVol[byVol.length - 1]            || null,  // lowest volume vs reference
    },
  }
}

// Compute price-led vs volume-led split between two sets of rows
function _revenueDriver(curRows, refRows) {
  const curSales = sum(curRows, 'Sales')
  const curVol   = sum(curRows, 'Sales Volume')
  const refSales = sum(refRows, 'Sales')
  const refVol   = sum(refRows, 'Sales Volume')
  const curASP   = curVol > 0 ? curSales / curVol : 0
  const refASP   = refVol > 0 ? refSales / refVol : 0
  const priceVar = (curASP - refASP) * curVol
  const volVar   = (curVol - refVol) * refASP
  return {
    revenueDriver: Math.abs(priceVar) >= Math.abs(volVar) ? 'price-led' : 'volume-led',
    totalPriceVar: priceVar,
    totalVolVar:   volVar,
  }
}

// ── Mode A: Actuals vs Budget (default) ──────────────────────────────────────
function _summaryVsBudget(rawData, filters) {
  const baseData = rawData.filter(row => {
    if (filters.sbu           !== 'All' && row['SBU']               !== filters.sbu)          return false
    if (filters.year          !== 'All' && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All' && row['FiscalQuarter']     !== filters.fiscalQuarter) return false
    return true
  })
  const actRows = baseData.filter(r => r.Scenario === 'Actuals')
  const budRows = baseData.filter(r => r.Scenario === 'Budgeted')
  if (!actRows.length || !budRows.length) return null

  const pgMetrics = _buildPGMetrics(actRows, budRows)
  const leaders   = _selectLeaders(pgMetrics)
  const driver    = _revenueDriver(actRows, budRows)

  // Gap to budget — latest Actuals month
  const latestMonth = MONTH_ORDER
    .filter(m => actRows.some(r => r.MonthName === m))
    .pop() || null
  let gapToBudget = null
  if (latestMonth) {
    const mActSales = sum(actRows.filter(r => r.MonthName === latestMonth), 'Sales')
    const mBudSales = sum(budRows.filter(r => r.MonthName === latestMonth), 'Sales')
    gapToBudget = {
      month:   latestMonth,
      actuals: mActSales,
      budget:  mBudSales,
      pct:     mBudSales > 0 ? mActSales / mBudSales * 100 : 0,
      gap:     mActSales - mBudSales,
    }
  }

  return { comparisonMode: 'vs_budget', comparisonLabel: 'vs Budget', ...leaders, ...driver, gapToBudget }
}

// ── Mode B: Actuals YoY ───────────────────────────────────────────────────────
function _summaryYoY(rawData, filters) {
  const baseAct = rawData.filter(r =>
    r.Scenario === 'Actuals' && (filters.sbu === 'All' || r['SBU'] === filters.sbu)
  )
  const allYears  = [...new Set(baseAct.map(r => String(r['FiscalYear'])).filter(Boolean))].sort()
  const curYear   = filters.year !== 'All' ? String(filters.year) : (allYears[allYears.length - 1] || null)
  if (!curYear) return null
  const prevYear  = String(Number(curYear) - 1)

  const rowsFor = (yr) => baseAct.filter(r => String(r['FiscalYear']) === yr)
  const curRows  = rowsFor(curYear)
  const prevRows = rowsFor(prevYear)
  if (!curRows.length || !prevRows.length) return null

  const pgMetrics = _buildPGMetrics(curRows, prevRows)
  const leaders   = _selectLeaders(pgMetrics)
  const driver    = _revenueDriver(curRows, prevRows)

  return { comparisonMode: 'yoy', comparisonLabel: `vs FY${prevYear}`, ...leaders, ...driver, gapToBudget: null }
}

// ── Mode C: Actuals QoQ ───────────────────────────────────────────────────────
function _summaryQoQ(rawData, filters) {
  const QTRS = ['FQ1','FQ2','FQ3','FQ4']
  const curQIdx = QTRS.indexOf(filters.fiscalQuarter)
  if (curQIdx < 0) return null
  const prevQtr  = curQIdx === 0 ? 'FQ4' : QTRS[curQIdx - 1]
  const prevYear = curQIdx === 0 ? String(Number(filters.year) - 1) : String(filters.year)

  const rowsFor = (yr, qtr) => rawData.filter(row =>
    row.Scenario === 'Actuals' &&
    (filters.sbu === 'All' || row['SBU'] === filters.sbu) &&
    String(row['FiscalYear']) === yr &&
    row['FiscalQuarter'] === qtr
  )
  const curRows  = rowsFor(String(filters.year), filters.fiscalQuarter)
  const prevRows = rowsFor(prevYear, prevQtr)
  if (!curRows.length || !prevRows.length) return null

  const pgMetrics = _buildPGMetrics(curRows, prevRows)
  const leaders   = _selectLeaders(pgMetrics)
  const driver    = _revenueDriver(curRows, prevRows)

  return { comparisonMode: 'qoq', comparisonLabel: `vs ${prevQtr}`, ...leaders, ...driver, gapToBudget: null }
}

// ── Executive Summary — public entry point ────────────────────────────────────
export function computeExecutiveSummary(rawData, filters) {
  const isActuals = filters.scenario === 'Actuals'
  const hasYear   = filters.year          !== 'All'
  const hasQtr    = filters.fiscalQuarter !== 'All'

  // Get mode-specific tailwinds / headwinds / gapToBudget
  let result
  if (isActuals && hasYear && hasQtr) result = _summaryQoQ(rawData, filters)
  else if (isActuals)                  result = _summaryYoY(rawData, filters)
  else                                 result = _summaryVsBudget(rawData, filters)
  if (!result) return null

  // Revenue driver pill is ALWAYS Actuals vs Budget for the selected SBU/Year/Quarter,
  // independent of the scenario dropdown.
  // Price effect = (Actual ASP − Budget ASP) × Actual Volume
  // Volume effect = (Actual Volume − Budget Volume) × Budget ASP
  const baseData = rawData.filter(row => {
    if (filters.sbu           !== 'All' && row['SBU']               !== filters.sbu)          return false
    if (filters.year          !== 'All' && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All' && row['FiscalQuarter']     !== filters.fiscalQuarter) return false
    return true
  })
  const actRows = baseData.filter(r => r.Scenario === 'Actuals')
  const budRows = baseData.filter(r => r.Scenario === 'Budgeted')
  const pillDriver = actRows.length && budRows.length
    ? _revenueDriver(actRows, budRows)
    : { revenueDriver: result.revenueDriver, totalPriceVar: result.totalPriceVar, totalVolVar: result.totalVolVar }

  return { ...result, ...pillDriver }
}

// ── Build a compact text summary for the AI Executive Overview ────────────────
export function buildExecutiveSummaryContext(dashData, filters) {
  if (!dashData) throw new Error('dashData is undefined — dashboard not yet computed')

  const kpis          = dashData.kpis          || { totalSales: 0, totalMargin: 0, totalCOGM: 0, totalVolume: 0, marginPct: 0 }
  const therapyRanked = dashData.therapyRanked || []
  const productRanked = dashData.productRanked || []
  const gaugeData     = dashData.gaugeData     || null

  const fmt = (n) => {
    const num = Number(n) || 0
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
    return `$${num.toFixed(0)}`
  }
  const pct  = (n) => `${(Number(n) || 0).toFixed(1)}%`

  const lines = [
    `Total Sales: ${fmt(kpis.totalSales)} | Margin: ${fmt(kpis.totalMargin)} | Margin%: ${pct(kpis.marginPct)} | COGM: ${fmt(kpis.totalCOGM)}`,
  ]

  if (therapyRanked.length > 0) {
    lines.push(`Top Therapy Areas: ${therapyRanked.slice(0, 5).map(t => `${t.name} ${fmt(t.sales)} margin ${pct(t.marginPct)}`).join(' | ')}`)
    if (therapyRanked.length > 3) {
      lines.push(`Lowest Therapy Areas: ${therapyRanked.slice(-3).map(t => `${t.name} ${fmt(t.sales)} margin ${pct(t.marginPct)}`).join(' | ')}`)
    }
  }

  if (productRanked.length > 0) {
    lines.push(`Top Products by Sales: ${productRanked.slice(0, 5).map(p => `${p.name} ${fmt(p.sales)}`).join(' | ')}`)
    const lowMargin = productRanked
      .filter(p => (Number(p.sales) || 0) > 0)
      .slice()
      .sort((a, b) => ((a.margin || 0) / Math.max(a.sales || 1, 1)) - ((b.margin || 0) / Math.max(b.sales || 1, 1)))
      .slice(0, 3)
    if (lowMargin.length > 0) {
      lines.push(`Lowest-margin products: ${lowMargin.map(p => `${p.name} ${pct((p.margin || 0) / Math.max(p.sales || 1, 1) * 100)}`).join(', ')}`)
    }
  }

  if (gaugeData) {
    lines.push(`Budget Achievement (${gaugeData.month}): Actuals ${gaugeData.actualsPct.toFixed(0)}% of budget | LE ${gaugeData.lePct.toFixed(0)}% of budget`)
  }

  return lines.join('\n')
}
