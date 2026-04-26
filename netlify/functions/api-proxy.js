// Netlify serverless function — API proxy
// Reads all config from server-side env vars so the API key is never
// baked into the client JS bundle.
// Triggered by: POST /api-proxy  (redirected via netlify.toml)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey    = process.env.VITE_API_KEY         || ''
  const endpoint  = process.env.VITE_API_ENDPOINT    || ''
  const apiPath   = process.env.VITE_API_PATH        || ''
  const apiFormat = process.env.VITE_API_FORMAT      || 'openai'
  const authStyle = process.env.VITE_API_AUTH_HEADER || 'bearer'

  if (!endpoint) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'VITE_API_ENDPOINT is not configured in Netlify environment variables.' }),
    }
  }

  // Build target URL — mirrors resolveEndpoint() in aiClient.js
  const base = endpoint.replace(/\/+$/, '')
  let target
  if (apiPath) {
    target = `${base}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`
  } else if (apiFormat === 'anthropic') {
    target = `${base}/messages`
  } else {
    target = `${base}/chat/completions`
  }

  // Build auth header — mirrors buildAuthHeaders() in aiClient.js
  const authHeader =
    authStyle === 'api-key'   ? { 'api-key':       apiKey } :
    authStyle === 'x-api-key' ? { 'x-api-key':     apiKey } :
                                { 'Authorization': `Bearer ${apiKey}` }

  try {
    const upstream = await fetch(target, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(apiFormat === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}),
      },
      body: event.body,
    })

    const text = await upstream.text()
    return {
      statusCode: upstream.status,
      headers:    { 'Content-Type': 'application/json' },
      body:       text,
    }
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: `Proxy error: ${err.message}` }),
    }
  }
}
