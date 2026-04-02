import WebSocket from 'ws'

/**
 * Handles the Telnyx media streaming WebSocket protocol.
 * Receives hotel audio (G.711 μ-law) and sends translated audio back.
 */
export class TelnyxStreamHandler {
  private ws: WebSocket
  private streamId: string | null = null
  private onAudio: (audioBase64: string) => void
  private onReady: () => void
  private onStop: () => void

  constructor(
    ws: WebSocket,
    callbacks: {
      onAudio: (audioBase64: string) => void
      onReady: () => void
      onStop: () => void
    }
  ) {
    this.ws = ws
    this.onAudio = callbacks.onAudio
    this.onReady = callbacks.onReady
    this.onStop = callbacks.onStop
    this.ws.on('message', (data) => this.handleMessage(data.toString()))
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw)

      switch (msg.event) {
        case 'connected':
          console.log('[telnyx-stream] Connected, protocol:', msg.protocol)
          break

        case 'start':
          this.streamId = msg.start?.stream_id || msg.stream_id
          console.log(`[telnyx-stream] Streaming started, stream_id: ${this.streamId}`)
          console.log(`[telnyx-stream] Format: ${JSON.stringify(msg.start?.media_format)}`)
          this.onReady()
          break

        case 'media':
          if (msg.media?.payload) {
            this.onAudio(msg.media.payload)
          }
          break

        case 'stop':
          console.log('[telnyx-stream] Streaming stopped')
          this.onStop()
          break
      }
    } catch {
      // Ignore non-JSON messages
    }
  }

  /**
   * Send translated audio back to the Telnyx call (bidirectional injection).
   * Audio must be base64-encoded G.711 μ-law at 8kHz.
   */
  sendAudio(audioBase64: string): void {
    if (!this.streamId || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(JSON.stringify({
      event: 'media',
      stream_id: this.streamId,
      media: {
        payload: audioBase64,
      },
    }))
  }

  /** Clear the Telnyx audio buffer (useful when interrupting). */
  clearBuffer(): void {
    if (!this.streamId || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(JSON.stringify({
      event: 'clear',
      stream_id: this.streamId,
    }))
  }
}
