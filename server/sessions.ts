import WebSocket from 'ws'
import { RealtimeTranslator } from './realtime'
import { TelnyxStreamHandler } from './telnyx-stream'
import { AudioRecorder } from './recorder'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SESSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 min max wait for both sides to connect

interface Session {
  id: string
  hotelLanguage: string
  operatorLanguage: string
  reservationId: string
  callId: string
  browserWs: WebSocket | null
  telnyxWs: WebSocket | null
  userToHotelRT: RealtimeTranslator | null
  hotelToUserRT: RealtimeTranslator | null
  telnyxHandler: TelnyxStreamHandler | null
  recorder: AudioRecorder
  transcriptPt: string[]
  transcriptLocal: string[]
  translationActive: boolean
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

export class SessionManager {
  private sessions = new Map<string, Session>()

  activeCount(): number {
    return this.sessions.size
  }

  createSession(params: {
    sessionId: string
    hotelLanguage: string
    operatorLanguage: string
    reservationId: string
    callId: string
  }): void {
    if (this.sessions.has(params.sessionId)) return

    const session: Session = {
      id: params.sessionId,
      hotelLanguage: params.hotelLanguage,
      operatorLanguage: params.operatorLanguage,
      reservationId: params.reservationId,
      callId: params.callId,
      browserWs: null,
      telnyxWs: null,
      userToHotelRT: null,
      hotelToUserRT: null,
      telnyxHandler: null,
      recorder: new AudioRecorder(params.sessionId),
      transcriptPt: [],
      transcriptLocal: [],
      translationActive: false,
      cleanupTimer: null,
    }

    session.cleanupTimer = setTimeout(() => {
      if (!session.translationActive) {
        console.log(`[sessions] Session ${params.sessionId} timed out waiting for connections`)
        this.endSession(params.sessionId)
      }
    }, SESSION_TIMEOUT_MS)

    this.sessions.set(params.sessionId, session)
  }

  handleBrowserConnection(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      ws.close(4004, 'Session not found — call /sessions first')
      return
    }

    session.browserWs = ws

    ws.on('message', (data) => {
      if (data instanceof Buffer || (data instanceof ArrayBuffer)) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        session.userToHotelRT?.sendAudio(buf.toString('base64'))
        session.recorder.recordUserOriginal(buf)
      } else {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'hangup') {
            this.endSession(sessionId)
          }
        } catch { /* ignore */ }
      }
    })

    ws.on('close', () => {
      console.log(`[sessions] Browser disconnected for ${sessionId}`)
      this.endSession(sessionId)
    })

    ws.on('error', (err) => {
      console.error(`[sessions] Browser WS error for ${sessionId}:`, err.message)
    })

    this.tryStartTranslation(session)
  }

  handleTelnyxConnection(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      ws.close(4004, 'Session not found — call /sessions first')
      return
    }

    session.telnyxWs = ws

    session.telnyxHandler = new TelnyxStreamHandler(ws, {
      onAudio: (audioBase64: string) => {
        session.hotelToUserRT?.sendAudio(audioBase64)
        session.recorder.recordHotelOriginal(Buffer.from(audioBase64, 'base64'))
      },
      onReady: () => {
        console.log(`[sessions] Telnyx stream ready for ${sessionId}`)
        this.tryStartTranslation(session)
      },
      onStop: () => {
        console.log(`[sessions] Telnyx stream stopped for ${sessionId}`)
        this.endSession(sessionId)
      },
    })

    ws.on('close', () => {
      console.log(`[sessions] Telnyx disconnected for ${sessionId}`)
      this.endSession(sessionId)
    })

    ws.on('error', (err) => {
      console.error(`[sessions] Telnyx WS error for ${sessionId}:`, err.message)
    })
  }

  private async tryStartTranslation(session: Session): Promise<void> {
    if (session.translationActive || !session.browserWs || !session.telnyxHandler) {
      return
    }

    session.translationActive = true
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer)
      session.cleanupTimer = null
    }

    console.log(`[sessions] Starting translation for ${session.id}: ${session.operatorLanguage} ↔ ${session.hotelLanguage}`)

    try {
      // Operator → Hotel: PCM16 (from browser) → G.711 μ-law (to Telnyx)
      session.userToHotelRT = new RealtimeTranslator({
        inputFormat: 'pcm16',
        outputFormat: 'g711_ulaw',
        sourceLanguageCode: session.operatorLanguage,
        targetLanguageCode: session.hotelLanguage,
        onAudio: (audioBase64) => {
          session.telnyxHandler?.sendAudio(audioBase64)
        },
        onInputTranscript: (text) => {
          const label = session.operatorLanguage === 'pt' ? 'OPERADOR' : 'OPERATOR'
          session.transcriptPt.push(`[${label}]: ${text}`)
          session.browserWs?.send(JSON.stringify({
            type: 'transcript',
            role: 'operator',
            text,
            language: session.operatorLanguage,
          }))
        },
        onOutputTranscript: (translated) => {
          session.transcriptLocal.push(`[OPERATOR→HOTEL]: ${translated}`)
          session.browserWs?.send(JSON.stringify({
            type: 'transcript',
            role: 'operator_translated',
            text: translated,
            language: session.hotelLanguage,
          }))
        },
        onError: (err) => {
          console.error(`[sessions] User→Hotel RT error: ${err}`)
          session.browserWs?.send(JSON.stringify({ type: 'error', message: err }))
        },
      })

      // Hotel → Operator: G.711 μ-law (from Telnyx) → PCM16 (to browser)
      session.hotelToUserRT = new RealtimeTranslator({
        inputFormat: 'g711_ulaw',
        outputFormat: 'pcm16',
        sourceLanguageCode: session.hotelLanguage,
        targetLanguageCode: session.operatorLanguage,
        onAudio: (audioBase64) => {
          if (session.browserWs?.readyState === WebSocket.OPEN) {
            session.browserWs.send(Buffer.from(audioBase64, 'base64'))
          }
        },
        onInputTranscript: (text) => {
          session.transcriptLocal.push(`[HOTEL]: ${text}`)
          session.browserWs?.send(JSON.stringify({
            type: 'transcript',
            role: 'hotel',
            text,
            language: session.hotelLanguage,
          }))
        },
        onOutputTranscript: (translated) => {
          session.transcriptPt.push(`[HOTEL→OPERATOR]: ${translated}`)
          session.browserWs?.send(JSON.stringify({
            type: 'transcript',
            role: 'hotel_translated',
            text: translated,
            language: session.operatorLanguage,
          }))
        },
        onError: (err) => {
          console.error(`[sessions] Hotel→User RT error: ${err}`)
          session.browserWs?.send(JSON.stringify({ type: 'error', message: err }))
        },
      })

      await Promise.all([
        session.userToHotelRT.connect(),
        session.hotelToUserRT.connect(),
      ])

      console.log(`[sessions] Translation active for ${session.id}`)
      session.browserWs?.send(JSON.stringify({ type: 'translation_active' }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sessions] Failed to start translation for ${session.id}: ${msg}`)
      session.browserWs?.send(JSON.stringify({ type: 'error', message: `Translation init failed: ${msg}` }))
      session.translationActive = false
    }
  }

  private async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.sessions.delete(sessionId)

    if (session.cleanupTimer) clearTimeout(session.cleanupTimer)

    console.log(`[sessions] Ending session ${sessionId}`)

    session.userToHotelRT?.disconnect()
    session.hotelToUserRT?.disconnect()

    if (session.browserWs?.readyState === WebSocket.OPEN) {
      session.browserWs.send(JSON.stringify({ type: 'call_ended' }))
      session.browserWs.close()
    }
    if (session.telnyxWs?.readyState === WebSocket.OPEN) {
      session.telnyxWs.close()
    }

    try {
      await session.recorder.finalize(
        session.callId,
        session.transcriptPt,
        session.transcriptLocal
      )

      await supabase
        .from('calls')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', session.callId)

      await supabase
        .from('reservations')
        .update({ status: 'review_needed' })
        .eq('id', session.reservationId)

      console.log(`[sessions] Session ${sessionId} finalized`)
    } catch (err) {
      console.error(`[sessions] Error finalizing session ${sessionId}:`, err)
    }
  }
}
