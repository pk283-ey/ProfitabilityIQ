// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// Update .env with VITE_API_KEY and VITE_API_ENDPOINT to connect your endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export const API_KEY        = import.meta.env.VITE_API_KEY        || ''
export const API_ENDPOINT   = import.meta.env.VITE_API_ENDPOINT   || ''
export const API_FORMAT     = import.meta.env.VITE_API_FORMAT     || 'openai'
export const MODEL          = import.meta.env.VITE_MODEL          || ''
// VITE_API_AUTH_HEADER and VITE_API_PATH are read directly in aiClient.js
