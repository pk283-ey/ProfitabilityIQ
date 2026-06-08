import { API_KEY, API_ENDPOINT, API_FORMAT, MODEL } from '../config/api.js'
import { parseQueryIntent } from './intentParser.js'
import { queryCube, queryVariances, formatCubeContext } from './dataCube.js'
import { computeForecast } from './forecaster.js'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveEndpoint() {
  const base   = API_ENDPOINT.replace(/\/+$/, '')
  const custom = import.meta.env.VITE_API_PATH || ''
  if (custom) return `${base}${custom.startsWith('/') ? '' : '/'}${custom}`
  if (API_FORMAT === 'anthropic') return `${base}/messages`
  return `${base}/chat/completions`
}

function buildAuthHeaders() {
  const style = import.meta.env.VITE_API_AUTH_HEADER || 'bearer'
  if (style === 'api-key')   return { 'api-key':       API_KEY }
  if (style === 'x-api-key') return { 'x-api-key':     API_KEY }
  return { 'Authorization': `Bearer ${API_KEY}` }
}

function extractContent(json) {
  if (json.choices?.[0]?.message?.content != null) return json.choices[0].message.content
  if (json.choices?.[0]?.text             != null) return json.choices[0].text
  if (json.content?.[0]?.text             != null) return json.content[0].text
  if (typeof json.response   === 'string')         return json.response
  if (typeof json.text       === 'string')         return json.text
  if (typeof json.output     === 'string')         return json.output
  if (typeof json.completion === 'string')         return json.completion
  if (json.message?.content  != null)              return json.message.content

  console.error('[PI] Unrecognised API response shape:', JSON.stringify(json))
  throw new Error('Unrecognised API response shape — check browser console (F12) for details.')
}

async function callAPI(messages, systemContent) {
  const isAnthropic = API_FORMAT === 'anthropic'

  const body = isAnthropic
    ? { system: systemContent, messages, max_tokens: 4096, ...(MODEL ? { model: MODEL } : {}) }
    : { messages: [{ role: 'system', content: systemContent }, ...messages], max_completion_tokens: 4096, ...(MODEL ? { model: MODEL } : {}) }

  const fullEndpoint = resolveEndpoint()
  // Dev:  Vite proxy needs the full path to know which origin to forward to
  // Prod: Netlify Function at /api-proxy builds the target URL from env vars
  let url
  if (import.meta.env.DEV) {
    try {
      const u = new URL(fullEndpoint)
      url = `/api-proxy${u.pathname}${u.search}`
    } catch {
      url = fullEndpoint
    }
  } else {
    url = '/api-proxy'
  }

  const authHeaders = buildAuthHeaders()

  if (import.meta.env.DEV) {
    console.group('%c[PI] API call', 'color:#6366f1;font-weight:bold')
    console.log('URL:', url, '| Auth:', Object.keys(authHeaders)[0], '| Model:', MODEL || 'default')
    console.groupEnd()
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(isAnthropic ? { 'anthropic-version': '2023-06-01' } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${errText}`)
  }

  return extractContent(await res.json()).trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(summary, cubeContext, intentMeta) {
  return `You are Fino — the AI financial analyst embedded in Lupin ProfitIQ, a specialized analytics platform for Lupin US pharmaceutical operations.

DATASET OVERVIEW:
- Rows: ${summary.rowCount.toLocaleString()} | Scenarios: ${summary.scenarios.join(', ')}
- Period: FY${summary.fiscalYears.join('/')} | Quarters: ${summary.fiscalQuarters.join(', ')}
- Therapy Areas (${summary.uniqueTherapyCount}): ${summary.therapyAreas.join(', ')}
- Divisions: ${summary.divisions.join(', ')}
- Products: ${summary.uniqueProductCount} groups | ${summary.uniqueSKUCount} SKUs
- Dataset totals (all scenarios combined for reference only): Sales ${summary.totalSalesFmt} | COGM ${summary.totalCOGMFmt} | Margin ${summary.totalMarginFmt}

QUERY CONTEXT (detected intent: ${intentMeta.analysisType}):
- Filters applied: Scenarios=${JSON.stringify(intentMeta.scenarios || 'all')} | FiscalYears=${JSON.stringify(intentMeta.years || 'all')} | Quarters=${JSON.stringify(intentMeta.quarters || 'all')} | Months=${JSON.stringify(intentMeta.months || 'all')}
- Grouped by: ${intentMeta.groupDims.length > 0 ? intentMeta.groupDims.join(', ') : 'TOTAL'}

DATA FOR THIS QUERY — PRE-FILTERED AND PRE-COMPUTED FROM SOURCE ROWS, USE EXACTLY AS-IS:
IMPORTANT: Every number below is ALREADY scoped to the filters listed above. Do NOT say data is unavailable or refer to a broader period — the figures below ARE the answer.
${cubeContext}

VARIANCE DEFINITIONS:
  Price Variance   = (Actual ASP − Budget ASP) × Actual Volume   [already computed in data above]
  Volume Variance  = (Actual Volume − Budget Volume) × Budget ASP [already computed in data above]
  Margin Cost Var  = (Budget Unit Cost − Actual Unit Cost) × Actual Volume
  Margin Vol Var   = (Actual Volume − Budget Volume) × Budget Unit Margin

CRITICAL RULES:
1. Respond ONLY with valid JSON — no text outside JSON.
2. NEVER derive, estimate, back-calculate, or infer any number. Use ONLY values present in the DATA section above. If a figure is missing, say "not in dataset".
3. NEVER blend or sum across Scenarios. Actuals, Budgeted, Latest Estimate are separate views.
4. Format: "$245.3M", "$1.2B", "45.2%", "+$12.1M (F)" for favourable, "−$3.2M (U)" for unfavourable.
5. Always include "insight" — 1–2 sentence interpretation.
6. DEFAULT to "text" or "table". Only use "chart"/"html"/"forecast" when user EXPLICITLY asks for a chart/graph/visual.
7. For variance: always split Price Effect and Volume Effect, label each F or U.

EXECUTIVE SUMMARY RULE (triggers on: "highlight", "exec summary", "financial summary"):
Respond as "multi" type with 3 sections IN ORDER:
  1 — Sales Performance: Actuals vs Budget, split into Price Effect + Volume Effect (F/U each)
  2 — Margin Performance: Margin $ and % Actuals vs Budget (F/U)
  3 — COGS: COGM and Unit Cost Actuals vs Budget (F/U — lower cost = Favourable)
Each section uses a "table" component.

RESPONSE FORMATS (pick exactly one):
{"type":"text","content":"...","insight":"..."}
{"type":"table","title":"...","insight":"...","headers":["Col1","Col2"],"rows":[["val","val"]]}
{"type":"chart","chartType":"bar|line|area|pie|stacked_bar","title":"...","insight":"...","labels":["A"],"datasets":[{"name":"Actuals","values":[0]}]}
{"type":"cards","title":"...","cards":[{"label":"Net Sales","value":"$929.5M","sub":"FY2026","trend":"up"}]}
{"type":"forecast","title":"...","insight":"...","labels":["Apr","May"],"actuals":[1e6,null],"budget":[1.1e6,1.2e6],"le":[1.05e6,1.15e6],"projected":[null,1.18e6]}
{"type":"html","title":"...","insight":"...","html":"<!DOCTYPE html><html>...</html>"}
{"type":"multi","components":[{...},{...}]}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Build cube-based context for the query
// ─────────────────────────────────────────────────────────────────────────────

// Row caps: variance rows are ~400 chars each; summary rows ~180 chars each.
// Keeping total context under ~12 KB prevents Netlify function timeouts.
const MAX_VARIANCE_ROWS = 30
const MAX_SUMMARY_ROWS  = 60
const MAX_TREND_ROWS    = 80

function capRows(data, limit) {
  if (data.length <= limit) return { rows: data, truncated: 0 }
  return { rows: data.slice(0, limit), truncated: data.length - limit }
}

function buildCubeContext(cube, intent) {
  const filter = {
    scenarios:     intent.scenarios     || undefined,
    years:         intent.years         || undefined,
    quarters:      intent.quarters      || undefined,
    months:        intent.months        || undefined,
    therapyAreas:  intent.therapyAreas  || undefined,
    productGroups: intent.productGroups || undefined,
    divisions:     intent.divisions     || undefined,
    yearCol:       cube.metadata.yearCol,
  }

  const { analysisType, groupDims, topN, isBottom } = intent

  // Build a human-readable scope label to prepend to every context block
  const scopeParts = [
    intent.scenarios?.length    ? `Scenario: ${intent.scenarios.join(', ')}`          : 'Scenario: All',
    intent.years?.length        ? `FiscalYear: ${intent.years.join(', ')}`             : 'FiscalYear: All',
    intent.quarters?.length     ? `Quarter: ${intent.quarters.join(', ')}`             : null,
    intent.months?.length       ? `Month: ${intent.months.join(', ')}`                 : null,
    intent.therapyAreas?.length ? `TherapyArea: ${intent.therapyAreas.join(', ')}`    : null,
    intent.productGroups?.length? `ProductGroup: ${intent.productGroups.join(', ')}`  : null,
    intent.divisions?.length    ? `Division: ${intent.divisions.join(', ')}`           : null,
  ].filter(Boolean)
  const scopeHeader = `DATA SCOPE — pre-filtered to: ${scopeParts.join(' | ')}\n` +
    `All figures below reflect ONLY this scope. Do NOT say data is missing or refer to any broader period.\n`

  let data
  if (analysisType === 'variance' || analysisType === 'executive_summary') {
    data = queryVariances(cube, filter, groupDims)
    if (topN) {
      data = isBottom ? data.slice(-topN) : data.slice(0, topN)
    } else {
      const { rows, truncated } = capRows(data, MAX_VARIANCE_ROWS)
      data = rows
      if (truncated > 0) {
        return scopeHeader +
          formatCubeContext(data, 'variance', groupDims) +
          `\n[NOTE: ${truncated} additional rows omitted — results sorted by Actuals Sales descending. Use "top N" in your question to see specific rankings.]`
      }
    }
    return scopeHeader + formatCubeContext(data, 'variance', groupDims)
  }

  if (analysisType === 'trend') {
    const trendDims = [...new Set([...groupDims, 'Scenario', 'MonthName'])]
    data = queryCube(cube, filter, trendDims)
    const { rows, truncated } = capRows(data, MAX_TREND_ROWS)
    data = rows
    const ctx = scopeHeader + formatCubeContext(data, 'trend', trendDims)
    return truncated > 0
      ? ctx + `\n[NOTE: ${truncated} additional rows omitted.]`
      : ctx
  }

  // Default: scenario comparison / summary / ranking
  data = queryCube(cube, filter, groupDims)
  if (topN) {
    data = isBottom ? data.slice(-topN) : data.slice(0, topN)
  } else {
    const { rows, truncated } = capRows(data, MAX_SUMMARY_ROWS)
    data = rows
    if (truncated > 0) {
      return scopeHeader +
        formatCubeContext(data, analysisType, groupDims) +
        `\n[NOTE: ${truncated} additional rows omitted — results sorted by Sales descending. Use "top N" to see specific rankings.]`
    }
  }
  return scopeHeader + formatCubeContext(data, analysisType, groupDims)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main chat message function
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMessage(messages, rawData, summary, cube) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || ''

  // Forecast: still uses JS forecaster (unchanged)
  if (/forecast|predict|project/i.test(lastUserMsg)) {
    const metric = /margin/i.test(lastUserMsg) ? 'Margin' : /volume/i.test(lastUserMsg) ? 'Volume' : 'Sales'
    const forecastData = computeForecast(summary, metric)
    const context = `Pre-computed forecast data:\n${JSON.stringify(forecastData, null, 2)}\n\nUser asked: "${lastUserMsg}"\n\nReturn a forecast JSON using exactly this data, filling in the "insight" field.`
    const raw   = await callAPI([{ role: 'user', content: context }], buildSystemPrompt(summary, context, { analysisType: 'forecast', scenarios: null, years: null, quarters: null, groupDims: [] }))
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      const parsed = JSON.parse(clean)
      return parsed.type === 'forecast' ? { ...parsed, ...forecastData } : { type: 'forecast', title: `${forecastData.metric} Forecast`, insight: parsed.insight || '', ...forecastData }
    } catch { return { type: 'forecast', title: `${forecastData.metric} Forecast`, insight: '', ...forecastData } }
  }

  // All other queries: use cube + intent parser
  const intent       = parseQueryIntent(lastUserMsg, cube.metadata)
  const cubeContext  = buildCubeContext(cube, intent)
  const systemPrompt = buildSystemPrompt(summary, cubeContext, intent)

  if (import.meta.env.DEV) {
    console.log('[PI] Intent:', intent)
    console.log('[PI] Cube context (first 800 chars):', cubeContext.slice(0, 800))
  }

  const raw   = await callAPI(messages, systemPrompt)
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    return { type: 'text', content: clean, insight: '' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Overview — dashboard summary bullets (JS-generated, no API call)
// ─────────────────────────────────────────────────────────────────────────────
export async function getExecutiveSummary(context, filters) {
  const salesMatch  = context.match(/Total Sales:\s*(\S+)/)
  const marginMatch = context.match(/Margin%:\s*([\d.]+%)/)
  const topTA       = context.match(/Top Therapy Areas:\s*([^|]+)/)
  const budgetMatch = context.match(/Actuals (\d+)% of budget/)

  const totalSales = salesMatch?.[1]  || 'N/A'
  const marginPct  = marginMatch?.[1] || 'N/A'
  const topArea    = topTA?.[1]?.trim().split(' ')[0] || 'Top Therapy Area'
  const budgetPct  = budgetMatch?.[1] || null

  return [
    {
      type: 'positive',
      bold: 'Net Sales',
      detail: `Total net sales of ${totalSales} for ${filters.scenario} · ${filters.year === 'All' ? 'all years' : `FY${filters.year}`}${filters.fiscalQuarter !== 'All' ? ` · ${filters.fiscalQuarter}` : ''}.`,
    },
    {
      type: topArea !== 'Top Therapy Area' ? 'positive' : 'neutral',
      bold: topArea,
      detail: `Leading therapy area by net sales contribution in the selected period.`,
    },
    {
      type: Number(marginPct) >= 40 ? 'positive' : Number(marginPct) >= 25 ? 'warning' : 'negative',
      bold: 'Margin Health',
      detail: `Overall margin rate of ${marginPct} — ${Number(marginPct) >= 40 ? 'above target; strong portfolio profitability.' : Number(marginPct) >= 25 ? 'approaching threshold; monitor COGM trends.' : 'below target; cost review recommended.'}`,
    },
    {
      type: budgetPct ? (Number(budgetPct) >= 100 ? 'positive' : Number(budgetPct) >= 80 ? 'warning' : 'negative') : 'neutral',
      bold: 'Budget Achievement',
      detail: budgetPct
        ? `Actuals at ${budgetPct}% of budget for the latest tracked month.`
        : 'Budget comparison data not available for the selected filters.',
    },
    {
      type: 'neutral',
      bold: 'AI Commentary',
      detail: 'Live AI narrative. Select filters above to explore performance by therapy area, product group, or division.',
    },
  ]
}
