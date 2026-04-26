import { useState, useRef, useEffect } from 'react'
import {
  Sparkles, Send, ArrowLeft, RotateCcw,
  FileSpreadsheet, ChevronDown,
} from 'lucide-react'
import ResponseRenderer from './ResponseRenderer.jsx'
import { sendMessage } from '../lib/aiClient.js'
import { computeForecast } from '../lib/forecaster.js'

// ── Suggested starter prompts ────────────────────────────────────────────────
const STARTERS = [
  'Show me total sales and margin by therapy area',
  'Compare Actuals vs Budget vs Latest Estimate for all quarters',
  'What are the top 10 products by sales?',
  'Show a monthly sales trend with forecast for next 3 months',
  'Which therapy area has the highest margin percentage?',
  'Break down COGM by manufacturing source',
]

// ── Single message bubble ─────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 msg-enter ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold
        ${isUser ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-brand-600'}`}>
        {isUser ? 'U' : <Sparkles size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        {isUser ? (
          <div className="bg-brand-600 text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm leading-relaxed">
            {msg.content}
          </div>
        ) : (
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 w-full">
            {msg.loading
              ? <div className="flex items-center gap-1.5 py-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              : msg.error
                ? <p className="text-red-500 text-sm">{msg.error}</p>
                : <ResponseRenderer response={msg.response} />
            }
          </div>
        )}
        <span className="text-[10px] text-slate-400 px-1">
          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ── Main ChatScreen ───────────────────────────────────────────────────────────
export default function ChatScreen({ parsedData, onBack }) {
  const { rawData, summary, fileName, cube } = parsedData

  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [showStarters, setShowStarters] = useState(true)
  const bottomRef  = useRef()
  const inputRef   = useRef()
  const historyRef = useRef([]) // tracks OpenAI-format history for API

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send a message ──────────────────────────────────────────────────────────
  async function send(text) {
    const q = (text || input).trim()
    if (!q || busy) return

    setInput('')
    setShowStarters(false)
    setBusy(true)

    const userMsg  = { role: 'user',      content: q,  ts: Date.now() }
    const thinkMsg = { role: 'assistant', loading: true, ts: Date.now() }

    setMessages(prev => [...prev, userMsg, thinkMsg])

    // Build conversation history for API (last 10 turns)
    historyRef.current = [...historyRef.current, { role: 'user', content: q }].slice(-20)

    // Special case: if query looks like a forecast request, run JS forecaster
    // and inject pre-computed data (AI still writes the insight)
    let injectedForecast = null
    if (/forecast|predict|project/i.test(q)) {
      const metric = /margin/i.test(q) ? 'Margin' : /volume/i.test(q) ? 'Volume' : 'Sales'
      injectedForecast = computeForecast(summary, metric)
    }

    try {
      let response

      if (injectedForecast) {
        // Inject JS forecast + ask AI only for insight text
        const context = `Here is the pre-computed forecast data:\n${JSON.stringify(injectedForecast, null, 2)}\n\nUser asked: "${q}"\n\nReturn a forecast JSON response using exactly this data, filling in the "insight" field with your interpretation.`
        response = await sendMessage(
          [{ role: 'user', content: context }],
          rawData, summary, cube,
        )
        // Ensure forecast data is accurate (from JS, not hallucinated)
        if (response.type === 'forecast') {
          response = { ...response, ...injectedForecast }
        } else {
          response = { type: 'forecast', title: `${injectedForecast.metric} Forecast — Actuals vs Budget vs Latest Estimate`, insight: response.insight || '', ...injectedForecast }
        }
      } else {
        response = await sendMessage(historyRef.current, rawData, summary, cube)
      }

      const assistantContent = JSON.stringify(response)
      historyRef.current = [...historyRef.current, { role: 'assistant', content: assistantContent }].slice(-20)

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, loading: false, response } : m
      ))
    } catch (e) {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, loading: false, error: e.message || 'Something went wrong. Check your API key and endpoint.' }
          : m
      ))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function clearChat() {
    setMessages([])
    historyRef.current = []
    setShowStarters(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="btn-ghost text-slate-500 px-2">
          <ArrowLeft size={16} />
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <Sparkles size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-800">Lupin ProfitIQ — Ask Fino</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <FileSpreadsheet size={12} />
          <span className="max-w-xs truncate font-medium text-slate-600">{fileName}</span>
          <span>·</span>
          <span>{summary.rowCount.toLocaleString()} rows</span>
        </div>
        <button onClick={clearChat} className="btn-ghost text-slate-400 px-2" title="Clear chat">
          <RotateCcw size={15} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-24 py-8 flex flex-col gap-6">

        {/* Welcome / starters */}
        {showStarters && (
          <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-200">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800">Ready to analyze your data</h2>
              <p className="text-sm text-slate-500 mt-1">
                Ask anything — sales trends, margin breakdowns, forecasts, top products.
              </p>
            </div>

            {/* Data pills */}
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {[
                `${summary.rowCount.toLocaleString()} rows`,
                `${summary.uniqueProductCount} products`,
                `${summary.uniqueTherapyCount} therapy areas`,
                ...summary.scenarios,
                ...summary.fiscalQuarters,
              ].map((t, i) => (
                <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 font-medium">
                  {t}
                </span>
              ))}
            </div>

            {/* Starter questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700
                    hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 transition-all duration-150
                    flex items-center gap-2 group"
                >
                  <ChevronDown size={13} className="text-brand-400 rotate-[-90deg] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200 bg-white px-4 md:px-12 lg:px-24 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about sales, margins, trends, forecasts… (Enter to send)"
              rows={1}
              disabled={busy}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-4
                text-sm text-slate-800 placeholder-slate-400 outline-none
                focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100
                disabled:opacity-50 transition-all leading-relaxed"
              style={{ minHeight: 48, maxHeight: 160 }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            className="w-12 h-12 flex-shrink-0 rounded-2xl bg-brand-600 text-white
              flex items-center justify-center hover:bg-brand-700 active:bg-brand-800
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-brand-200"
          >
            {busy
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Shift+Enter for new line · Charts and tables are generated from your data
        </p>
      </div>
    </div>
  )
}
