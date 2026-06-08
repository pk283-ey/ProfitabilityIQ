// ─────────────────────────────────────────────────────────────────────────────
// Intent Parser
// Converts a natural-language query into a structured filter + groupBy spec
// that is applied against the data cube — no regex keyword guessing.
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

export function parseQueryIntent(query, metadata) {
  const q   = query.toLowerCase()
  const raw = query  // original case for name matching

  // ── Scenario detection ────────────────────────────────────────────────────
  const hasActuals = /\bactuals?\b/i.test(q)
  const hasBudget  = /\bbudget(ed)?\b/i.test(q)
  const hasLE      = /\blatest\s*estimate\b|\ble\b/i.test(q)
  const multiScenario = [hasActuals, hasBudget, hasLE].filter(Boolean).length > 1
    || /\bcompare\b|\bvs\.?\b|\bversus\b|\ball\s*scenario/i.test(q)

  let scenarios = null  // null = no filter (include all)
  if (!multiScenario) {
    if (hasActuals) scenarios = ['Actuals']
    else if (hasBudget) scenarios = ['Budgeted']
    else if (hasLE) scenarios = ['Latest Estimate']
  }

  // ── Year detection ────────────────────────────────────────────────────────
  const yearRaw = [...raw.matchAll(/\bfy\s*(\d{4}|\d{2})\b|\b(20\d{2})\b/gi)]
  const years = yearRaw.length > 0
    ? [...new Set(yearRaw.map(m => {
        const n = (m[1] || m[2]).replace(/^fy/i, '')
        return n.length === 2 ? `20${n}` : n
      }))]
    : null

  // ── Quarter detection ─────────────────────────────────────────────────────
  const qMatches = [...raw.matchAll(/\b(fq[1-4]|q[1-4])\b/gi)]
  const quarters = qMatches.length > 0
    ? [...new Set(qMatches.map(m => m[1].toUpperCase().replace(/^Q/, 'FQ')))]
    : null

  // ── Month detection ───────────────────────────────────────────────────────
  const months = MONTH_ORDER.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(raw))
  const monthFilter = months.length > 0 ? months : null

  // ── Entity filters — match exact names from metadata ─────────────────────
  // Only match entity names that are at least 4 chars to avoid false positives
  // (e.g. digit "0" in "FY2026" accidentally matching a numeric metadata value)
  const therapyAreas = metadata.therapyAreas.filter(t => {
    const s = String(t).toLowerCase()
    return s.length >= 4 && q.includes(s)
  })
  const productGroups = metadata.productGroups.filter(p => {
    const s = String(p).toLowerCase()
    return s.length >= 4 && q.includes(s)
  })
  const divisions = metadata.divisions.filter(d => {
    const s = String(d).toLowerCase()
    return s.length >= 4 && q.includes(s)
  })

  // ── GroupBy dimensions ────────────────────────────────────────────────────
  const groupDims = []

  // Scenario: include if multi-scenario OR no scenario filter (show all side-by-side)
  if (multiScenario || scenarios === null) {
    groupDims.push('Scenario')
  }

  if (/therapy\s*area|therapy/i.test(q))              groupDims.push('Therapy Area')
  if (/product\s*group|product(?!\s*group)|sku|brand/i.test(q)) groupDims.push('Product Group')
  if (/division|divison/i.test(q))                    groupDims.push('Divison')
  if (/quarter|fq[1-4]/i.test(q) && !quarters)        groupDims.push('FiscalQuarter')
  else if (quarters?.length > 1)                       groupDims.push('FiscalQuarter')
  if (/month|monthly|trend|over\s*time/i.test(q))     groupDims.push('MonthName')
  if (/manufactur/i.test(q))                          groupDims.push('Manufacturing Source')

  // ── Analysis type ─────────────────────────────────────────────────────────
  let analysisType = 'summary'
  if (/\bvariance\b|price\s*(var|effect)|volume\s*(var|effect)|price\s*&\s*vol/i.test(q))
    analysisType = 'variance'
  else if (/\bhighlight\b|\bexec(utive)?\s*summ|\bfinancial\s*(highlight|summ)/i.test(q))
    analysisType = 'executive_summary'
  else if (/\bforecast\b|\bpredict\b|\bproject(ion)?\b/i.test(q))
    analysisType = 'forecast'
  else if (/\btrend\b|\bmonthly\b|\bover\s*time\b/i.test(q))
    analysisType = 'trend'
  else if (/\bcompare\b|\bvs\.?\b|\bversus\b/i.test(q))
    analysisType = 'comparison'
  else if (/\bimproved?\b|\bgrowth\s+from\b|\bchange\s+from\b|from\s+(fq|q)\d.*\bto\b.*\b(fq|q)\d/i.test(q))
    analysisType = 'comparison'
  else if (/top\s*\d+|\bbottom\s*\d+|\branking\b|\bbest\b|\bworst\b/i.test(q))
    analysisType = 'ranking'

  // For variance / exec summary always ensure Scenario is NOT in groupDims
  // (variance function handles Actuals vs Budgeted split internally)
  const groupDimsForVariance = groupDims.filter(d => d !== 'Scenario')

  const topN = raw.match(/\btop\s*(\d+)\b/i)?.[1]
    ? parseInt(raw.match(/\btop\s*(\d+)\b/i)[1])
    : raw.match(/\bbottom\s*(\d+)\b/i)?.[1]
      ? parseInt(raw.match(/\bbottom\s*(\d+)\b/i)[1])
      : null

  const isBottom = /\bbottom\s*\d+/i.test(q)

  return {
    scenarios,
    years,
    quarters,
    months: monthFilter,
    therapyAreas:  therapyAreas.length  > 0 ? therapyAreas  : null,
    productGroups: productGroups.length > 0 ? productGroups : null,
    divisions:     divisions.length     > 0 ? divisions     : null,
    groupDims:            analysisType === 'variance' || analysisType === 'executive_summary'
                            ? groupDimsForVariance
                            : groupDims,
    analysisType,
    topN,
    isBottom,
  }
}
