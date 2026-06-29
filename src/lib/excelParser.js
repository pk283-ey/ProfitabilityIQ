import * as XLSX from 'xlsx'
import { dimVal } from './dataCube.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const sum  = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
const fmt  = (n) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function groupBy(arr, keys) {
  const map = {}
  for (const row of arr) {
    const k = keys.map(k => dimVal(row[k])).join('|||')
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

function aggregateGroup(rows, groupKeys) {
  const s = sum(rows, 'Sales')
  const c = sum(rows, 'COGM')
  const m = sum(rows, 'Margin')
  const v = sum(rows, 'Sales Volume')
  const obj = {}
  groupKeys.forEach(k => { obj[k] = dimVal(rows[0][k]) })
  obj['Sales']        = s
  obj['COGM']         = c
  obj['Margin']       = m
  obj['Sales Volume'] = v
  obj['Margin%']      = s !== 0 ? ((m / s) * 100).toFixed(1) + '%' : '—'
  return obj
}

function buildBreakdown(data, groupKey) {
  const grouped = groupBy(data, [groupKey])
  return Object.entries(grouped)
    .map(([k, rows]) => aggregateGroup(rows, [groupKey]))
    .sort((a, b) => b['Sales'] - a['Sales'])
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────
export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const wb     = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet  = wb.Sheets[wb.SheetNames[0]]
  const raw    = XLSX.utils.sheet_to_json(sheet, { defval: null })

  if (!raw.length) throw new Error('No data found in the uploaded file.')

  const columns = Object.keys(raw[0])

  // Identify column types
  const numericCols     = []
  const categoricalCols = []
  for (const col of columns) {
    const sample = raw.slice(0, 20).map(r => r[col]).filter(v => v !== null)
    const isNum  = sample.length > 0 && sample.every(v => typeof v === 'number' || !isNaN(Number(v)))
    if (isNum) numericCols.push(col)
    else categoricalCols.push(col)
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalSales  = sum(raw, 'Sales')
  const totalCOGM   = sum(raw, 'COGM')
  const totalMargin = sum(raw, 'Margin')
  const totalVol    = sum(raw, 'Sales Volume')

  const uniq = (key) => [...new Set(raw.map(r => r[key]).filter(Boolean))]

  // Monthly time series (for forecasting)
  const MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
  const byMonthScenario = {}
  const grouped = groupBy(raw, ['MonthName', 'Scenario'])
  for (const [key, rows] of Object.entries(grouped)) {
    const [month, scenario] = key.split('|||')
    if (!byMonthScenario[scenario]) byMonthScenario[scenario] = {}
    byMonthScenario[scenario][month] = {
      Sales: sum(rows, 'Sales'),
      Margin: sum(rows, 'Margin'),
      COGM: sum(rows, 'COGM'),
      Volume: sum(rows, 'Sales Volume'),
    }
  }

  const summary = {
    rowCount:           raw.length,
    columnCount:        columns.length,
    totalSales,
    totalCOGM,
    totalMargin,
    totalVolume:        totalVol,
    marginPercent:      totalSales ? ((totalMargin / totalSales) * 100).toFixed(1) : '0',
    totalSalesFmt:      fmt(totalSales),
    totalMarginFmt:     fmt(totalMargin),
    totalCOGMFmt:       fmt(totalCOGM),
    scenarios:          uniq('Scenario'),
    fiscalYears:        uniq('FiscalYear'),
    fiscalQuarters:     uniq('FiscalQuarter'),
    therapyAreas:       uniq('Therapy Area'),
    productGroups:      uniq('Product Group'),
    divisions:          uniq('Divison'),
    manufacturingSources: uniq('Manufacturing Source'),
    uniqueProductCount: uniq('Product Group').length,
    uniqueTherapyCount: uniq('Therapy Area').length,
    uniqueSKUCount:     uniq('SKU code').length,
    monthOrder:         MONTH_ORDER,
    byMonthScenario,
    byTherapyArea:      buildBreakdown(raw, 'Therapy Area'),
    byDivision:         buildBreakdown(raw, 'Divison'),
    byScenario:         buildBreakdown(raw, 'Scenario'),
    byQuarter:          buildBreakdown(raw, 'FiscalQuarter'),
    byManufacturing:    buildBreakdown(raw, 'Manufacturing Source'),
  }

  // Preview: first 100 rows, select readable columns
  const previewCols = [
    'SKU Desc', 'Therapy Area', 'Product Group', 'Divison', 'Scenario',
    'FiscalQuarter', 'MonthName', 'Year', 'Sales Volume', 'Sales', 'COGM', 'Margin',
  ].filter(c => columns.includes(c))

  const previewData = raw.slice(0, 100).map(r => {
    const row = {}
    previewCols.forEach(c => { row[c] = r[c] })
    return row
  })

  return { rawData: raw, columns, numericCols, categoricalCols, summary, previewData, previewCols }
}
