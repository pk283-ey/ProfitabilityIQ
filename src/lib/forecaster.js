import * as ss from 'simple-statistics'

const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

// ─────────────────────────────────────────────────────────────────────────────
// Extract a monthly series for one scenario + metric
// ─────────────────────────────────────────────────────────────────────────────
function extractSeries(byMonthScenario, scenario, metric) {
  const scen = byMonthScenario[scenario] || {}
  return MONTH_ORDER.map(m => scen[m]?.[metric] ?? null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Linear regression forecast on non-null actuals
// Returns projected values for all 12 months (null where we have real data)
// ─────────────────────────────────────────────────────────────────────────────
function linearForecast(series, forecastMonths = 3) {
  const points = series
    .map((v, i) => (v !== null ? [i, v] : null))
    .filter(Boolean)

  if (points.length < 2) return Array(12).fill(null)

  const { m, b } = ss.linearRegression(points)
  const predict  = (x) => Math.max(0, m * x + b)

  const lastIdx  = points[points.length - 1][0]
  const result   = Array(12).fill(null)
  for (let i = lastIdx + 1; i < Math.min(12, lastIdx + 1 + forecastMonths); i++) {
    result[i] = Math.round(predict(i))
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: compute full forecast comparison
// ─────────────────────────────────────────────────────────────────────────────
export function computeForecast(summary, metric = 'Sales', forecastMonths = 3) {
  const { byMonthScenario } = summary

  const actuals   = extractSeries(byMonthScenario, 'Actuals',         metric)
  const budget    = extractSeries(byMonthScenario, 'Budgeted',        metric)
  const le        = extractSeries(byMonthScenario, 'Latest Estimate', metric)
  const projected = linearForecast(actuals, forecastMonths)

  // Replace nulls in actual arrays with null (keep sparse)
  return {
    labels:    MONTH_ORDER,
    actuals,
    budget,
    le,
    projected,
    metric,
  }
}
