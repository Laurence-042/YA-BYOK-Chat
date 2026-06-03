export interface Env {
  YA_BYOK_Chat_LOG: KVNamespace
  TOKEN?: string
}

interface LogEntry {
  timestamp: string
  userMessage: string
  assistantMessage: string
}

function isLogEntry(v: unknown): v is LogEntry {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.timestamp === 'string' &&
    typeof o.userMessage === 'string' &&
    typeof o.assistantMessage === 'string'
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Token auth (optional — only enforced if TOKEN secret is set)
    if (env.TOKEN) {
      const auth = request.headers.get('Authorization') ?? ''
      const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (provided !== env.TOKEN) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response('Bad Request: invalid JSON', { status: 400 })
    }

    if (!isLogEntry(body)) {
      return new Response('Bad Request: missing fields', { status: 400 })
    }

    // Use timestamp as key; append random suffix to avoid collisions
    const key = `${body.timestamp}-${Math.random().toString(36).slice(2, 8)}`
    await env.YA_BYOK_Chat_LOG.put(key, JSON.stringify(body))

    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  },
} satisfies ExportedHandler<Env>
