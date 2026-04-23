import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export default function FileUpload({ onFile, loading }) {
  const inputRef   = useRef()
  const [drag, setDrag]   = useState(false)
  const [error, setError] = useState('')

  function validate(file) {
    if (!file) return 'No file selected.'
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'xlsm', 'csv'].includes(ext))
      return 'Please upload an Excel file (.xlsx, .xls, .xlsm) or CSV.'
    if (file.size > MAX_BYTES)
      return `File size ${(file.size / 1e6).toFixed(0)} MB exceeds the 100 MB limit.`
    return null
  }

  function handle(file) {
    const err = validate(file)
    if (err) { setError(err); return }
    setError('')
    onFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handle(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`
          relative w-full max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed
          px-10 py-16 flex flex-col items-center gap-4 transition-all duration-200
          ${drag
            ? 'border-brand-500 bg-brand-50 scale-[1.01]'
            : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-slate-50'}
          ${loading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-brand-100' : 'bg-slate-100'}`}>
          {loading
            ? <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            : <FileSpreadsheet size={32} className={drag ? 'text-brand-600' : 'text-slate-400'} />
          }
        </div>

        <div className="text-center">
          <p className="text-base font-semibold text-slate-700">
            {loading ? 'Parsing your file…' : 'Drop your Excel file here'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? 'This may take a few seconds for large files' : 'or click to browse · .xlsx · .xls · .csv · up to 100 MB'}
          </p>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${drag ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <Upload size={14} />
          Choose file
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv"
          className="hidden"
          onChange={(e) => handle(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-2xl w-full">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
