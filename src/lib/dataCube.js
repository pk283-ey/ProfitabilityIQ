// ─────────────────────────────────────────────────────────────────────────────
// Data Cube
// Built once on file upload from raw rows.
// Every metric is a direct sum of source data — nothing is estimated.
// ─────────────────────────────────────────────────────────────────────────────

// Aggregate a set of leaf records (already pre-summed) into one metrics object
function aggLeaves(leaves) {
  const sales  = leaves.reduce((s, r) => s + r.Sales,   0)
  const vol    = leaves.reduce((s, r) => s + r.Volume,  0)
  const cogm   = leaves.reduce((s, r) => s + r.COGM,    0)
  const margin = leaves.reduce((s, r) => s + r.Margin,  0)
  return {
    Sales:      Math.round(sales),
    Volume:     Math.round(vol),
    COGM:       Math.round(cogm),
    Margin:     Math.round(margin),
    ASP:        vol  > 0 ? sales  / vol  : 0,
    UnitCost:   vol  > 0 ? cogm   / vol  : 0,
    UnitMargin: vol  > 0 ? margin / vol  : 0,
    MarginPct:  sales > 0 ? margin / sales * 100 : 0,
  }
}

// ── Build the cube ────────────────────────────────────────────────────────────
// Leaf granularity: Scenario × Year × FiscalQuarter × MonthName × Therapy Area × Product Group × Divison
export function buildDataCube(rawData) {
  // Detect which year column is present in the data
  const YEAR_COL = rawData[0] != null && rawData[0]['FiscalYear'] != null ? 'FiscalYear' : 'Year'

  const DIMS = [
    'Scenario', YEAR_COL, 'FiscalQuarter', 'MonthName',
    'Therapy Area', 'Product Group', 'Divison',
  ]

  // Group raw rows into leaf cells
  const map = {}
  for (const row of rawData) {
    const key = DIMS.map(d => String(row[d] ?? '')).join('|||')
    if (!map[key]) map[key] = { _rows: 0, Sales: 0, Volume: 0, COGM: 0, Margin: 0 }
    map[key]._rows  += 1
    map[key].Sales  += Number(row['Sales'])        || 0
    map[key].Volume += Number(row['Sales Volume']) || 0
    map[key].COGM   += Number(row['COGM'])         || 0
    map[key].Margin += Number(row['Margin'])        || 0
  }

  if (import.meta.env.DEV && rawData.length > 0) {
    const sample = rawData[0]
    console.log('[Cube] Sample raw row keys:', Object.keys(sample))
    console.log('[Cube] Sample raw row:', { Scenario: sample.Scenario, Year: sample.Year, FiscalYear: sample.FiscalYear, FiscalQuarter: sample.FiscalQuarter, Sales: sample.Sales })
  }

  // Convert to leaf records with derived metrics
  const leaves = Object.entries(map).map(([key, agg]) => {
    const parts = key.split('|||')
    const rec = {}
    DIMS.forEach((d, i) => { rec[d] = parts[i] })
    const { Sales, Volume, COGM, Margin } = agg
    rec.Sales      = Math.round(Sales)
    rec.Volume     = Math.round(Volume)
    rec.COGM       = Math.round(COGM)
    rec.Margin     = Math.round(Margin)
    rec.ASP        = Volume > 0 ? Sales  / Volume : 0
    rec.UnitCost   = Volume > 0 ? COGM   / Volume : 0
    rec.UnitMargin = Volume > 0 ? Margin / Volume : 0
    rec.MarginPct  = Sales  > 0 ? Margin / Sales * 100 : 0
    return rec
  })

  // Metadata — exact values present in the data
  const uniq = (key) =>
    [...new Set(rawData.map(r => r[key]).filter(v => v != null && v !== '' && typeof v !== 'number'))]
      .map(String).filter(v => v.trim() !== '' && !/^\d+$/.test(v)).sort()

  const metadata = {
    scenarios:     uniq('Scenario'),
    years:         [...new Set(rawData.map(r => String(r[YEAR_COL])).filter(Boolean))].sort(),
    yearCol:       YEAR_COL,
    quarters:      ['FQ1','FQ2','FQ3','FQ4'].filter(q => rawData.some(r => r.FiscalQuarter === q)),
    months:        uniq('MonthName'),
    therapyAreas:  uniq('Therapy Area'),
    productGroups: uniq('Product Group'),
    divisions:     uniq('Divison'),
    manufacturingSources: uniq('Manufacturing Source'),
  }

  return { leaves, metadata }
}

// ── Filter + aggregate leaves ─────────────────────────────────────────────────
function filterLeaves(leaves, filter = {}) {
  let data = leaves
  const { scenarios, years, quarters, months, therapyAreas, productGroups, divisions, yearCol } = filter
  const yCol = yearCol || 'Year'
  if (scenarios?.length)     data = data.filter(r => scenarios.includes(r.Scenario))
  if (years?.length)         data = data.filter(r => years.includes(String(r[yCol])))
  if (quarters?.length)      data = data.filter(r => quarters.includes(r.FiscalQuarter))
  if (months?.length)        data = data.filter(r => months.includes(r.MonthName))
  if (therapyAreas?.length)  data = data.filter(r => therapyAreas.includes(r['Therapy Area']))
  if (productGroups?.length) data = data.filter(r => productGroups.includes(r['Product Group']))
  if (divisions?.length)     data = data.filter(r => divisions.includes(r['Divison']))
  return data
}

// Group filtered leaves by dimension keys and aggregate
function groupAndAgg(data, groupDims) {
  if (groupDims.length === 0) return [aggLeaves(data)]
  const groups = {}
  for (const leaf of data) {
    const key = groupDims.map(d => leaf[d] ?? 'Unknown').join('|||')
    if (!groups[key]) groups[key] = []
    groups[key].push(leaf)
  }
  return Object.entries(groups).map(([key, leaves]) => {
    const parts = key.split('|||')
    const dimValues = {}
    groupDims.forEach((d, i) => { dimValues[d] = parts[i] })
    return { ...dimValues, ...aggLeaves(leaves) }
  }).sort((a, b) => b.Sales - a.Sales)
}

// ── Public: query the cube ────────────────────────────────────────────────────
export function queryCube(cube, filter = {}, groupDims = []) {
  const data = filterLeaves(cube.leaves, filter)
  return groupAndAgg(data, groupDims)
}

// ── Public: variance analysis (Actuals vs Budgeted, with LE if available) ────
export function queryVariances(cube, filter = {}, groupDims = []) {
  // Remove scenario from the filter so we get all scenarios, then split
  const baseFilter = { ...filter, scenarios: undefined }

  const actLeaves  = filterLeaves(cube.leaves, { ...baseFilter, scenarios: ['Actuals'] })

  if (import.meta.env.DEV) {
    console.log('[Cube] queryVariances filter:', filter, '| groupDims:', groupDims)
    console.log('[Cube] actLeaves count:', actLeaves.length, '| first leaf:', actLeaves[0])
  }
  const budLeaves  = filterLeaves(cube.leaves, { ...baseFilter, scenarios: ['Budgeted'] })
  const leLeaves   = filterLeaves(cube.leaves, { ...baseFilter, scenarios: ['Latest Estimate'] })

  const actuals  = groupAndAgg(actLeaves,  groupDims)
  const budgeted = groupAndAgg(budLeaves,  groupDims)
  const le       = groupAndAgg(leLeaves,   groupDims)

  const makeKey  = (row) => groupDims.map(d => row[d]).join('|||')
  const budMap   = Object.fromEntries(budgeted.map(r => [makeKey(r), r]))
  const leMap    = Object.fromEntries(le.map(r => [makeKey(r), r]))

  const ZERO = { Sales: 0, Volume: 0, COGM: 0, Margin: 0, ASP: 0, UnitCost: 0, UnitMargin: 0, MarginPct: 0 }

  return actuals.map(act => {
    const k   = makeKey(act)
    const bud = budMap[k] || ZERO
    const leR = leMap[k]  || ZERO

    // Price & Volume variance (Sales)
    const priceVar      = (act.ASP      - bud.ASP)      * act.Volume
    const volumeVar     = (act.Volume   - bud.Volume)   * bud.ASP
    const totalSalesVar = priceVar + volumeVar

    // Margin variance components
    const mPriceVar  = priceVar
    const mCostVar   = (bud.UnitCost   - act.UnitCost)   * act.Volume
    const mVolVar    = (act.Volume     - bud.Volume)     * bud.UnitMargin
    const totalMargVar = mPriceVar + mCostVar + mVolVar

    const dimValues = {}
    groupDims.forEach(d => { dimValues[d] = act[d] })

    return {
      ...dimValues,
      Actuals: {
        Sales: act.Sales, Volume: act.Volume, COGM: act.COGM, Margin: act.Margin,
        ASP: +act.ASP.toFixed(4), UnitCost: +act.UnitCost.toFixed(4),
        MarginPct: +act.MarginPct.toFixed(2),
      },
      Budgeted: {
        Sales: bud.Sales, Volume: bud.Volume, COGM: bud.COGM, Margin: bud.Margin,
        ASP: +bud.ASP.toFixed(4), UnitCost: +bud.UnitCost.toFixed(4),
        MarginPct: +bud.MarginPct.toFixed(2),
      },
      LatestEstimate: leR.Sales > 0 ? {
        Sales: leR.Sales, Volume: leR.Volume, COGM: leR.COGM, Margin: leR.Margin,
        ASP: +leR.ASP.toFixed(4), UnitCost: +leR.UnitCost.toFixed(4),
        MarginPct: +leR.MarginPct.toFixed(2),
      } : null,
      SalesVariance: {
        AbsoluteVar:   Math.round(act.Sales  - bud.Sales),
        PctVar:        bud.Sales  > 0 ? +((act.Sales  - bud.Sales)  / bud.Sales  * 100).toFixed(1) : 0,
        PriceEffect:   Math.round(priceVar),
        VolumeEffect:  Math.round(volumeVar),
        TotalVar:      Math.round(totalSalesVar),
        Favourable:    totalSalesVar >= 0,
      },
      MarginVariance: {
        AbsoluteVar:   Math.round(act.Margin - bud.Margin),
        PctVar:        bud.Margin > 0 ? +((act.Margin - bud.Margin) / bud.Margin * 100).toFixed(1) : 0,
        PriceEffect:   Math.round(mPriceVar),
        CostEffect:    Math.round(mCostVar),
        VolumeEffect:  Math.round(mVolVar),
        TotalVar:      Math.round(totalMargVar),
        Favourable:    totalMargVar >= 0,
      },
      COGMVariance: {
        AbsoluteVar:   Math.round(act.COGM - bud.COGM),
        PctVar:        bud.COGM > 0 ? +((act.COGM - bud.COGM) / bud.COGM * 100).toFixed(1) : 0,
        Favourable:    act.COGM <= bud.COGM,
      },
    }
  })
}

// ── Format cube query results as a compact string for the AI ─────────────────
const fmtN = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
const fv = (n, fav) => fav ? `+${fmtN(Math.abs(n))} (F)` : `-${fmtN(Math.abs(n))} (U)`

export function formatCubeContext(data, analysisType, groupDims) {
  if (analysisType === 'variance') {
    const lines = [
      'VARIANCE DATA (Actuals vs Budgeted) — source: pre-computed from raw data, do not derive:',
      `Columns: ${groupDims.join(', ') || 'TOTAL'} | Actuals Sales | Budget Sales | Sales Var $ | Sales Var % | Price Effect | Volume Effect $ | Actuals Vol (units) | Budget Vol (units) | Vol Unit Var | Actuals Margin | Budget Margin | Margin Var $ | Actuals COGM | Budget COGM | COGM Var $`,
      '',
    ]
    for (const r of data) {
      const dimLabel = groupDims.map(d => r[d]).join(' / ') || 'TOTAL'
      const sv = r.SalesVariance, mv = r.MarginVariance, cv = r.COGMVariance
      lines.push(
        `${dimLabel}:` +
        ` Act Sales=${fmtN(r.Actuals.Sales)} Bud Sales=${fmtN(r.Budgeted.Sales)}` +
        ` SalesVar=${fv(sv.TotalVar, sv.Favourable)} (${sv.PctVar > 0 ? '+' : ''}${sv.PctVar}%)` +
        ` PriceEff=${fv(sv.PriceEffect, sv.PriceEffect >= 0)} VolumeEff=${fv(sv.VolumeEffect, sv.VolumeEffect >= 0)}` +
        ` | Act Vol(units)=${Math.round(r.Actuals.Volume).toLocaleString()} Bud Vol(units)=${Math.round(r.Budgeted.Volume).toLocaleString()}` +
        ` VolUnitVar=${r.Actuals.Volume - r.Budgeted.Volume >= 0 ? '+' : ''}${Math.round(r.Actuals.Volume - r.Budgeted.Volume).toLocaleString()} (${r.Budgeted.Volume > 0 ? ((r.Actuals.Volume - r.Budgeted.Volume) / r.Budgeted.Volume * 100).toFixed(1) : '—'}%)` +
        ` | Act Margin=${fmtN(r.Actuals.Margin)} Bud Margin=${fmtN(r.Budgeted.Margin)}` +
        ` MarginVar=${fv(mv.TotalVar, mv.Favourable)}` +
        ` | Act COGM=${fmtN(r.Actuals.COGM)} Bud COGM=${fmtN(r.Budgeted.COGM)}` +
        ` COGMVar=${fv(cv.AbsoluteVar, cv.Favourable)}`
      )
    }
    return lines.join('\n')
  }

  if (analysisType === 'trend') {
    const lines = ['MONTHLY TREND DATA (source: raw data, do not derive):']
    for (const r of data) {
      const dimLabel = groupDims.map(d => r[d]).join(' / ')
      lines.push(`${dimLabel}: Sales=${fmtN(r.Sales)} Volume=${Math.round(r.Volume).toLocaleString()} Margin=${fmtN(r.Margin)} MarginPct=${r.MarginPct.toFixed(1)}%`)
    }
    return lines.join('\n')
  }

  // Default: scenario comparison / summary
  const lines = ['DATA (source: raw data, do not derive or estimate any value):']
  const dimLabel = groupDims.length > 0 ? groupDims.join(' × ') : 'TOTAL'
  lines.push(`Grouped by: ${dimLabel}`)
  lines.push('')
  for (const r of data) {
    const label = groupDims.map(d => r[d]).join(' / ') || 'TOTAL'
    lines.push(
      `${label}: Sales=${fmtN(r.Sales)} Volume=${Math.round(r.Volume).toLocaleString()} COGM=${fmtN(r.COGM)} Margin=${fmtN(r.Margin)} MarginPct=${r.MarginPct.toFixed(1)}% ASP=${r.ASP > 0 ? '$' + r.ASP.toFixed(2) : '—'}`
    )
  }
  return lines.join('\n')
}
