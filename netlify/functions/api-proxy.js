// ─────────────────────────────────────────────────────────────────────────────
// Netlify Function — API Proxy
//
// Runs server-side on Netlify's infrastructure.
// Reads all API config from environment variables (never exposed to the browser).
// Forwards the request body to the configured AI endpoint and returns the response.
//
// Triggered via:  POST /api-proxy  (redirected from netlify.toml)
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  // ── Read config from server-side environment variables ─────────────────────
  const apiKey    = process.env.VITE_API_KEY           || ''
  const endpoint  = process.env.VITE_API_ENDPOINT      || ''
  const apiPath   = process.env.VITE_API_PATH          || ''
  const apiFormat = process.env.VITE_API_FORMAT        || 'openai'
  const authStyle = process.env.VITE_API_AUTH_HEADER   || 'bearer'

  if (!endpoint) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'VITE_API_ENDPOINT is not configured in Netlify environment variables.' }),
    }
  }

  // ── Build target URL (mirrors resolveEndpoint in aiClient.js) ──────────────
  const base = endpoint.replace(/\/+$/, '')
  let target
  if (apiPath) {
    target = `${base}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`
  } else if (apiFormat === 'anthropic') {
    target = `${base}/messages`
  } else {
    target = `${base}/chat/completions`
  }

  // ── Build auth header (mirrors buildAuthHeaders in aiClient.js) ────────────
  const authHeaders =
    authStyle === 'api-key'   ? { 'api-key':       apiKey } :
    authStyle === 'x-api-key' ? { 'x-api-key':     apiKey } :
    /* bearer default */        { 'Authorization': `Bearer ${apiKey}` }

  // ── Forward request to AI endpoint ─────────────────────────────────────────
  try {
    const response = await fetch(target, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(apiFormat === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}),
      },
      body: event.body,
    })

    const text = await response.text()
    return {
      statusCode: response.status,
      headers:    { 'Content-Type': 'application/json' },
      body:       text,
    }
  } catch (err) {
    console.error('[api-proxy] Fetch error:', err)
    return {
      statusCode: 502,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ error: `Proxy fetch error: ${err.message}` }),
    }
  }
}
