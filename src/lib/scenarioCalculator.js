// ─────────────────────────────────────────────────────────────────────────────
// Scenario Calculator
// Powers the Scenario Model tab — all what-if computations
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

// ── Filter options for scenario page ─────────────────────────────────────────
export function getScenarioOptions(rawData) {
  const uniq = (key) =>
    [...new Set(rawData.map(r => r[key]).filter(v => v != null && v !== ''))].map(String).sort()
  const fiscalYears = [...new Set(
    rawData.map(r => String(r['FiscalYear'] ?? r['Year'] ?? '')).filter(Boolean)
  )].sort()

  return {
    sbus:         ['All', ...uniq('Reported SBU')],
    therapyAreas: ['All', ...uniq('Therapy Area')],
    productGroups:['All', ...uniq('Product Group')],
    brandGroups:  ['All', ...uniq('Brand Group')],
    dosageForms:  ['All', ...uniq('Dosage Form')],
    skus:         ['All', ...uniq('SKU Desc')],
    years:        fiscalYears,
  }
}

// ── Get the latest available FiscalYear from Actuals ─────────────────────────
export function getLatestActualsYear(rawData) {
  const years = rawData
    .filter(r => r.Scenario === 'Actuals')
    .map(r => String(r['FiscalYear'] ?? r['Year'] ?? ''))
    .filter(Boolean)
  if (!years.length) return null
  return years.sort().reverse()[0]
}

// ── Filter rows for base (Actuals + user filters) ─────────────────────────────
function filterBaseRows(rawData, baseFilters) {
  return rawData.filter(row => {
    if (row.Scenario !== 'Actuals') return false
    if (baseFilters.year && String(row['FiscalYear'] ?? row['Year'] ?? '') !== String(baseFilters.year)) return false
    if (baseFilters.sbu          && baseFilters.sbu          !== 'All' && row['Reported SBU']   !== baseFilters.sbu)          return false
    if (baseFilters.therapyArea  && baseFilters.therapyArea  !== 'All' && row['Therapy Area']   !== baseFilters.therapyArea)  return false
    if (baseFilters.productGroup && baseFilters.productGroup !== 'All' && row['Product Group']  !== baseFilters.productGroup) return false
    if (baseFilters.brandGroup   && baseFilters.brandGroup   !== 'All' && row['Brand Group']    !== baseFilters.brandGroup)   return false
    if (baseFilters.dosageForm   && baseFilters.dosageForm   !== 'All' && row['Dosage Form']    !== baseFilters.dosageForm)   return false
    if (baseFilters.sku          && baseFilters.sku          !== 'All' && row['SKU Desc']        !== baseFilters.sku)          return false
    return true
  })
}

// ── Compute base aggregates from raw actuals rows ─────────────────────────────
export function computeBaseData(rawData, baseFilters) {
  const rows   = filterBaseRows(rawData, baseFilters)
  const Sales  = rows.reduce((s, r) => s + (Number(r.Sales)              || 0), 0)
  const Volume = rows.reduce((s, r) => s + (Number(r['Sales Volume'])    || 0), 0)
  const COGM   = rows.reduce((s, r) => s + (Number(r.COGM)              || 0), 0)
  const Margin = rows.reduce((s, r) => s + (Number(r.Margin)            || 0), 0)

  const PUSales = Volume > 0 ? Sales  / Volume : 0
  const PUCost  = Volume > 0 ? COGM   / Volume : 0
  const RMCost  = PUCost * 0.7   // fixed split — no randomness
  const PkgCost = PUCost * 0.1
  const OtherOH = PUCost * 0.2

  return {
    Sales:     Math.round(Sales),
    Volume:    Math.round(Volume),
    COGM:      Math.round(COGM),
    Margin:    Math.round(Margin),
    MarginPct: Sales > 0 ? Margin / Sales * 100 : 0,
    PUSales, PUCost, RMCost, PkgCost, OtherOH,
    rowCount:  rows.length,
  }
}

// ── Apply sliders to get scenario data ────────────────────────────────────────
export function computeScenarioData(base, sliders) {
  const { volumeChange, mrpChange, discount, rmCostAdj, pkgCostAdj, ohCostAdj, seasonality } = sliders

  const adjVolume  = base.Volume  * (1 + volumeChange / 100) * seasonality
  const adjPUSales = base.PUSales * (1 + mrpChange    / 100)
  const scenSales  = adjVolume * adjPUSales * (1 - discount / 100)

  const adjRM     = base.RMCost  * (1 + rmCostAdj  / 100)
  const adjPkg    = base.PkgCost * (1 + pkgCostAdj / 100)
  const adjOH     = base.OtherOH * (1 + ohCostAdj  / 100)
  const adjPUCost = adjRM + adjPkg + adjOH
  const scenCOGM  = adjVolume * adjPUCost
  const scenMargin = scenSales - scenCOGM

  return {
    Volume:    Math.round(adjVolume),
    PUSales:   adjPUSales,
    Sales:     Math.round(scenSales),
    PUCost:    adjPUCost,
    RMCost:    adjRM,
    PkgCost:   adjPkg,
    OtherOH:   adjOH,
    COGM:      Math.round(scenCOGM),
    Margin:    Math.round(scenMargin),
    MarginPct: scenSales > 0 ? scenMargin / scenSales * 100 : 0,
  }
}

// ── Waterfall bridge data for Recharts ────────────────────────────────────────
// Returns array of { label, value (signed), transparentBase, bar, start, end, isTotal, positive }
// transparentBase + bar are used as a stacked-bar trick so each segment "floats"
// at the correct height for BOTH positive and negative deltas.
export function computeWaterfall(base, scenario, sliders) {
  const { volumeChange, mrpChange, discount, rmCostAdj, pkgCostAdj, ohCostAdj, seasonality } = sliders

  const adjVolume  = base.Volume  * (1 + volumeChange / 100) * seasonality
  const adjPUSales = base.PUSales * (1 + mrpChange    / 100)

  const mrpImpact      = (adjPUSales - base.PUSales) * adjVolume * (1 - discount / 100)
  const volumeImpact   = (adjVolume - base.Volume)   * base.PUSales * (1 - discount / 100)
  const discountImpact = -(adjVolume * adjPUSales * (discount / 100))
  const rmImpact       = -(base.RMCost  * (rmCostAdj  / 100) * adjVolume)
  const pkgImpact      = -(base.PkgCost * (pkgCostAdj / 100) * adjVolume)
  const ohImpact       = -(base.OtherOH * (ohCostAdj  / 100) * adjVolume)

  const steps = [
    { label: 'Base Margin',      value: base.Margin,              isTotal: true  },
    { label: 'MRP',              value: Math.round(mrpImpact)      },
    { label: 'Volume',           value: Math.round(volumeImpact)   },
    { label: 'Discount',         value: Math.round(discountImpact) },
    { label: 'RM Cost',          value: Math.round(rmImpact)       },
    { label: 'Packaging',        value: Math.round(pkgImpact)      },
    { label: 'Overhead',         value: Math.round(ohImpact)       },
    { label: 'Scenario Margin',  value: scenario.Margin,          isTotal: true  },
  ]

  let running = 0
  return steps.map((seg) => {
    if (seg.isTotal) {
      running = seg.value
      return {
        ...seg,
        transparentBase: Math.min(0, seg.value),
        bar:             Math.abs(seg.value),
        start: 0, end: seg.value,
        positive: seg.value >= 0,
      }
    }
    const start = running
    const end   = running + seg.value
    running = end
    return {
      ...seg,
      transparentBase: Math.min(start, end),
      bar:             Math.abs(seg.value),
      start, end,
      positive: seg.value >= 0,
    }
  })
}

// ── Trend + linear-regression forecast ────────────────────────────────────────
export function computeTrendData(rawData, baseFilters, forecastMonths) {
  const rows = rawData.filter(row => {
    if (row.Scenario !== 'Actuals') return false
    if (baseFilters.sbu && baseFilters.sbu !== 'All' && row['Reported SBU'] !== baseFilters.sbu) return false
    return true
  })

  // Aggregate by MonthName (ordered by fiscal month sequence)
  const monthMap = {}
  for (const row of rows) {
    const m = row.MonthName
    if (!m) continue
    if (!monthMap[m]) monthMap[m] = { Sales: 0, Margin: 0 }
    monthMap[m].Sales  += Number(row.Sales)  || 0
    monthMap[m].Margin += Number(row.Margin) || 0
  }

  const historical = MONTH_ORDER
    .filter(m => monthMap[m])
    .map((m, i) => ({
      month: m, idx: i,
      Sales:  Math.round(monthMap[m].Sales),
      Margin: Math.round(monthMap[m].Margin),
    }))

  if (historical.length < 2) return { historical, forecast: [] }

  // Simple linear regression
  function linReg(pts) {
    const n = pts.length
    const sx  = pts.reduce((a, p) => a + p.x, 0)
    const sy  = pts.reduce((a, p) => a + p.y, 0)
    const sxy = pts.reduce((a, p) => a + p.x * p.y, 0)
    const sx2 = pts.reduce((a, p) => a + p.x * p.x, 0)
    const denom = n * sx2 - sx * sx
    if (denom === 0) return { slope: 0, intercept: sy / n }
    const slope     = (n * sxy - sx * sy) / denom
    const intercept = (sy - slope * sx) / n
    return { slope, intercept }
  }

  const sReg = linReg(historical.map((h, i) => ({ x: i, y: h.Sales  })))
  const mReg = linReg(historical.map((h, i) => ({ x: i, y: h.Margin })))

  // Standard deviation of residuals (for confidence band on Sales)
  const resid = historical.map((h, i) => h.Sales - (sReg.slope * i + sReg.intercept))
  const std   = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / resid.length)

  const forecast = Array.from({ length: forecastMonths }, (_, i) => {
    const x = historical.length + i
    const projSales  = Math.round(sReg.slope * x + sReg.intercept)
    const projMargin = Math.round(mReg.slope * x + mReg.intercept)
    return {
      month:      `+${i + 1}m`,
      idx:        x,
      Sales:      null,
      Margin:     null,
      projSales,
      projMargin,
      salesLow:   Math.round(projSales - 1.5 * std),
      salesHigh:  Math.round(projSales + 1.5 * std),
    }
  })

  return { historical, forecast }
}

// ── Auto insights ─────────────────────────────────────────────────────────────
export function generateInsights(base, scenario, sliders) {
  const drivers = [
    { label: 'MRP change',          impact: (scenario.PUSales - base.PUSales) * scenario.Volume * (1 - sliders.discount / 100) },
    { label: 'Volume change',       impact: (scenario.Volume  - base.Volume)  * base.PUSales   * (1 - sliders.discount / 100) },
    { label: 'Discount',            impact: -(scenario.Volume * scenario.PUSales * sliders.discount / 100) },
    { label: 'Raw material cost',   impact: -(base.RMCost  * (sliders.rmCostAdj  / 100) * scenario.Volume) },
    { label: 'Packaging cost',      impact: -(base.PkgCost * (sliders.pkgCostAdj / 100) * scenario.Volume) },
    { label: 'Overhead cost',       impact: -(base.OtherOH * (sliders.ohCostAdj  / 100) * scenario.Volume) },
  ]

  const sorted     = [...drivers].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
  const topDriver  = sorted[0]
  const marginDiff = scenario.Margin - base.Margin

  const insights = []

  // Top driver
  insights.push({
    type:   topDriver.impact >= 0 ? 'positive' : 'negative',
    text:   `Largest driver: ${topDriver.label} ${topDriver.impact >= 0 ? 'added' : 'reduced'} margin by ${fmtAbs(topDriver.impact)}.`,
    badge:  'Top Driver',
  })

  // Overall margin
  insights.push({
    type: marginDiff >= 0 ? 'positive' : 'negative',
    text: marginDiff >= 0
      ? `Scenario improves margin by ${fmtAbs(marginDiff)} vs base (+${(scenario.MarginPct - base.MarginPct).toFixed(1)} pts).`
      : `Scenario reduces margin by ${fmtAbs(marginDiff)} vs base (${(scenario.MarginPct - base.MarginPct).toFixed(1)} pts).`,
    badge: 'Margin',
  })

  // Volume
  if (sliders.volumeChange !== 0) {
    insights.push({
      type: sliders.volumeChange > 0 ? 'positive' : 'negative',
      text: `Volume ${sliders.volumeChange > 0 ? 'increase' : 'decrease'} of ${Math.abs(sliders.volumeChange)}% ${sliders.volumeChange > 0 ? 'supports' : 'reduces'} revenue scale.`,
      badge: 'Volume',
    })
  }

  // Discount warning
  if (sliders.discount > 10) {
    insights.push({
      type: 'negative',
      text: `Discount of ${sliders.discount}% materially reduces net realization — consider impact on margin %.`,
      badge: 'Discount',
    })
  }

  // Cost alert
  const totalCostAdj = sliders.rmCostAdj + sliders.pkgCostAdj + sliders.ohCostAdj
  if (totalCostAdj > 5) {
    insights.push({
      type: 'negative',
      text: `Combined cost increase of ~${totalCostAdj.toFixed(0)}% across RM, packaging and OH compresses unit margins.`,
      badge: 'Cost',
    })
  } else if (totalCostAdj < -5) {
    insights.push({
      type: 'positive',
      text: `Combined cost reduction of ~${Math.abs(totalCostAdj).toFixed(0)}% is a significant margin tailwind.`,
      badge: 'Cost',
    })
  }

  return { insights, topDriver: topDriver.label, drivers: sorted }
}

function fmtAbs(n) {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`
  return `$${abs.toFixed(0)}`
}
