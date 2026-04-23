import { useState, useRef } from 'react'
import { LayoutDashboard, Sparkles } from 'lucide-react'
import FileUpload from './FileUpload.jsx'
import MetricCards from './MetricCards.jsx'
import DataPreview from './DataPreview.jsx'
import { parseExcelFile } from '../lib/excelParser.js'
import { buildDataCube } from '../lib/dataCube.js'

export default function UploadScreen({ onReady }) {
  const [loading, setLoading]     = useState(false)
  const [parsed, setParsed]       = useState(null)
  const [fileName, setFileName]   = useState('')
  const [parseErr, setParseErr]   = useState('')
  const rawRef = useRef(null)

  async function handleFile(file) {
    setLoading(true)
    setParseErr('')
    setParsed(null)
    try {
      const result = await parseExcelFile(file)
      rawRef.current = result.rawData
      result.cube = buildDataCube(result.rawData)
      setFileName(file.name)
      setParsed(result)
    } catch (e) {
      setParseErr(e.message || 'Failed to parse file.')
    } finally {
      setLoading(false)
    }
  }

  function handleAnalyze() {
    if (!parsed) return
    onReady({ ...parsed, rawData: rawRef.current, fileName })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-base font-semibold text-slate-800">Profitability Intelligence</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex flex-col gap-10">
        {/* Hero */}
        <div className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full border border-brand-100">
            <Sparkles size={11} /> AI-Powered Financial Analysis
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Upload your data,<br />
            <span className="text-brand-600">ask anything.</span>
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            Drop an Excel or CSV file up to 100 MB. The AI will parse every row and let you explore sales, margins, forecasts, and trends through natural conversation.
          </p>
        </div>

        {/* Upload zone */}
        <FileUpload onFile={handleFile} loading={loading} />

        {parseErr && (
          <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-2xl mx-auto w-full">
            {parseErr}
          </div>
        )}

        {/* Post-parse: cards + preview */}
        {parsed && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {fileName}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {parsed.summary.rowCount.toLocaleString()} rows parsed successfully
                </p>
              </div>
              <button onClick={handleAnalyze} className="btn-primary gap-2">
                <LayoutDashboard size={15} />
                Open Dashboard
              </button>
            </div>

            <MetricCards summary={parsed.summary} />
            <DataPreview
              previewData={parsed.previewData}
              previewCols={parsed.previewCols}
              totalRows={parsed.summary.rowCount}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 py-4 px-6">
        <p className="text-center text-xs text-slate-400">
          Profitability Intelligence · Data processed locally in your browser · No data leaves your device
        </p>
      </footer>
    </div>
  )
}
