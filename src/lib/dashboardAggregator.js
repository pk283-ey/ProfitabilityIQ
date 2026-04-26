// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Aggregator — all data transformations for the dashboard
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

const sum  = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)

function groupBy(arr, key) {
  const map = {}
  for (const row of arr) {
    const k = (row[key] ?? 'Unknown')
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

// ── Executive Summary (pure JS — no API call) ─────────────────────────────────
// Always ignores the scenario filter so it can compare Actuals vs Budgeted.
export function computeExecutiveSummary(rawData, filters) {
  // ── Base filter: SBU + FiscalYear + Quarter only (never Scenario) ────────────
  const baseData = rawData.filter(row => {
    if (filters.sbu          !== 'All' && row['SBU']               !== filters.sbu)          return false
    if (filters.year         !== 'All' && String(row['FiscalYear']) !== String(filters.year))  return false
    if (filters.fiscalQuarter !== 'All'&& row['FiscalQuarter']      !== filters.fiscalQuarter) return false
    return true
  })

  const actRows = baseData.filter(r => r.Scenario === 'Actuals')
  const budRows = baseData.filter(r => r.Scenario === 'Budgeted')
  if (actRows.length === 0 || budRows.length === 0) return null

  // ── Aggregate raw rows by a dimension key ────────────────────────────────────
  function aggBy(rows, dim) {
    const map = {}
    for (const row of rows) {
      const k = row[dim] || 'Unknown'
      if (!map[k]) map[k] = { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
      map[k].Sales  += Number(row['Sales'])        || 0
      map[k].Volume += Number(row['Sales Volume']) || 0
      map[k].COGM   += Number(row['COGM'])         || 0
      map[k].Margin += Number(row['Margin'])       || 0
    }
    return map
  }

  // ── Compute variance rows for every group within a dimension ─────────────────
  function computeVars(actMap, budMap) {
    const keys = [...new Set([...Object.keys(actMap), ...Object.keys(budMap)])]
    return keys.map(k => {
      const a = actMap[k] || { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
      const b = budMap[k] || { Sales: 0, Volume: 0, COGM: 0, Margin: 0 }

      const ASP_a  = a.Volume > 0 ? a.Sales  / a.Volume : 0
      const ASP_b  = b.Volume > 0 ? b.Sales  / b.Volume : 0
      const UC_a   = a.Volume > 0 ? a.COGM   / a.Volume : 0
      const UC_b   = b.Volume > 0 ? b.COGM   / b.Volume : 0

      const priceVar   = (ASP_a - ASP_b)       * a.Volume           // $ price effect
      const volVar     = (a.Volume - b.Volume)  * ASP_b             // $ volume effect
      const cogmVar    = (UC_b   - UC_a)        * a.Volume           // $ cost var (positive = favourable)
      const mPctAct    = a.Sales > 0 ? a.Margin / a.Sales * 100 : 0
      const mPctBud    = b.Sales > 0 ? b.Margin / b.Sales * 100 : 0
      const mPctExpBps = (mPctAct - mPctBud) * 100                  // basis points

      return {
        name: k,
        actSales: a.Sales,  budSales: b.Sales,
        actVol:   a.Volume, budVol:   b.Volume,
        priceVar, volVar, cogmVar,
        mPctAct, mPctBud, mPctExpBps,
        volVarPct: b.Volume > 0 ? (a.Volume - b.Volume) / b.Volume * 100 : 0,
      }
    }).filter(r => r.budSales > 0 || r.actSales > 0)
  }

  const taVars = computeVars(aggBy(actRows, 'Therapy Area'), aggBy(budRows, 'Therapy Area'))
  const pgVars = computeVars(aggBy(actRows, 'Product Group'), aggBy(budRows, 'Product Group'))

  // ── Value Drivers — top 2 PGs ────────────────────────────────────────────────
  // Driver 1: best price var + margin expansion
  const pgByDriver = [...pgVars]
    .filter(r => r.priceVar > 0 || r.mPctExpBps > 0)
    .sort((a, b) => (b.priceVar + b.mPctExpBps * 1e4) - (a.priceVar + a.mPctExpBps * 1e4))
  const twPG1 = pgByDriver[0] || null

  // Driver 2: best PG by volume var (different product from twPG1)
  const pgByVolDriver = [...pgVars]
    .filter(r => r.volVar > 0 && r.name !== twPG1?.name)
    .sort((a, b) => b.volVar - a.volVar)
  const twPG2 = pgByVolDriver[0] || pgByDriver[1] || null

  // ── Value Eroders — top 2 PGs ─────────────────────────────────────────────────
  // Eroder 1: worst COGM pressure (cost overrun)
  const pgByCOGM = [...pgVars].sort((a, b) => a.cogmVar - b.cogmVar)
  const hwPG1 = pgByCOGM.find(r => r.cogmVar < 0) || null

  // Eroder 2: worst vol var (different product from hwPG1)
  const pgByVolEroder = [...pgVars]
    .filter(r => r.volVar < 0 && r.name !== hwPG1?.name)
    .sort((a, b) => a.volVar - b.volVar)
  const hwPG2 = pgByVolEroder[0] || pgByCOGM[1] || null

  // ── Revenue driver (total across all therapy areas) ──────────────────────────
  const totalPriceVar = taVars.reduce((s, r) => s + r.priceVar, 0)
  const totalVolVar   = taVars.reduce((s, r) => s + r.volVar,   0)
  const revenueDriver = Math.abs(totalPriceVar) >= Math.abs(totalVolVar) ? 'price-led' : 'volume-led'

  // ── Gap to Budget — latest Actuals month (option B) ──────────────────────────
  let gapToBudget = null
  const actualsMonths = actRows.map(r => r.MonthName).filter(Boolean)
  const latestMonth   = MONTH_ORDER.filter(m => actualsMonths.includes(m)).pop() || null
  if (latestMonth) {
    const mAct = actRows.filter(r => r.MonthName === latestMonth)
    const mBud = budRows.filter(r => r.MonthName === latestMonth)
    const mActSales = mAct.reduce((s, r) => s + (Number(r['Sales']) || 0), 0)
    const mBudSales = mBud.reduce((s, r) => s + (Number(r['Sales']) || 0), 0)
    gapToBudget = {
      month:   latestMonth,
      actuals: mActSales,
      budget:  mBudSales,
      pct:     mBudSales > 0 ? mActSales / mBudSales * 100 : 0,
      gap:     mActSales - mBudSales,
    }
  }

  return {
    tailwinds: { pg1: twPG1, pg2: twPG2 },
    headwinds: { pg1: hwPG1, pg2: hwPG2 },
    revenueDriver,
    totalPriceVar,
    totalVolVar,
    gapToBudget,
  }
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
