import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { URL } from 'url'
import { SessionManager } from './sessions'

const PORT = parseInt(process.env.PORT || '8080')
const API_SECRET = process.env.BRIDGE_API_SECRET || ''

const sessionManager = new SessionManager()

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', sessions: sessionManager.activeCount() }))
    return
  }

  if (req.url === '/sessions' && req.method === 'POST') {
    if (API_SECRET) {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${API_SECRET}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
    }

    let body = ''
    for await (const chunk of req) body += chunk

    try {
      const params = JSON.parse(body)
      const { session_id, hotel_language, operator_language, reservation_id, call_id } = params

      if (!session_id || !hotel_language || !reservation_id || !call_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields' }))
        return
      }

      sessionManager.createSession({
        sessionId: session_id,
        hotelLanguage: hotel_language,
        operatorLanguage: operator_language || 'pt',
        reservationId: reservation_id,
        callId: call_id,
      })

      console.log(`[bridge] Session created: ${session_id} (${operator_language} ↔ ${hotel_language})`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ session_id, status: 'created' }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`)
  const sessionId = url.searchParams.get('session')
  const path = url.pathname

  if (!sessionId) {
    ws.close(4000, 'Missing session parameter')
    return
  }

  if (path === '/telnyx-stream') {
    console.log(`[bridge] Telnyx stream connected for session ${sessionId}`)
    sessionManager.handleTelnyxConnection(sessionId, ws)
  } else if (path === '/live-call') {
    console.log(`[bridge] Browser connected for session ${sessionId}`)
    sessionManager.handleBrowserConnection(sessionId, ws)
  } else {
    ws.close(4004, 'Unknown path')
  }
})

server.listen(PORT, () => {
  console.log(`Translation bridge listening on port ${PORT}`)
})
