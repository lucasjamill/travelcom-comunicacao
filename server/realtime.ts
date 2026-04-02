import WebSocket from 'ws'

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-mini-realtime-preview'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

const LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Mandarin Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  ar: 'Arabic',
  hi: 'Hindi',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  pt: 'Portuguese',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  de: 'German',
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

export interface RealtimeTranslatorConfig {
  inputFormat: 'pcm16' | 'g711_ulaw'
  outputFormat: 'pcm16' | 'g711_ulaw'
  sourceLanguageCode: string
  targetLanguageCode: string
  onAudio: (audioBase64: string) => void
  onInputTranscript: (text: string) => void
  onOutputTranscript: (text: string) => void
  onError: (error: string) => void
}

export class RealtimeTranslator {
  private ws: WebSocket | null = null
  private config: RealtimeTranslatorConfig
  private connected = false

  constructor(config: RealtimeTranslatorConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      })

      const timeout = setTimeout(() => {
        reject(new Error('OpenAI Realtime connection timeout'))
      }, 10000)

      this.ws.on('open', () => {
        clearTimeout(timeout)
        this.connected = true
        this.configureSession()
        resolve()
      })

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('error', (err) => {
        clearTimeout(timeout)
        console.error('[realtime] WebSocket error:', err.message)
        this.config.onError(err.message)
        if (!this.connected) reject(err)
      })

      this.ws.on('close', (code, reason) => {
        console.log(`[realtime] Disconnected: ${code} ${reason.toString()}`)
        this.connected = false
      })
    })
  }

  private configureSession(): void {
    const sourceLang = getLanguageName(this.config.sourceLanguageCode)
    const targetLang = getLanguageName(this.config.targetLanguageCode)

    const instructions = `You are a professional real-time interpreter for hotel business calls.
Your sole task is to translate speech from ${sourceLang} to ${targetLang}.

CRITICAL RULES:
- Translate everything you hear faithfully and naturally into ${targetLang}
- Preserve the tone, intent, and politeness level
- Do NOT add your own commentary, answers, or responses
- Do NOT answer questions — translate them exactly
- If you hear a greeting, translate the greeting
- If something is unclear, translate what you can
- Speak naturally as if you ARE the person speaking, just in ${targetLang}
- Use professional, polite language appropriate for hotel business calls
- NEVER mention that you are a translator or AI
- Keep translations concise — do not embellish or add extra words`

    this.send({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions,
        voice: 'echo',
        input_audio_format: this.config.inputFormat,
        output_audio_format: this.config.outputFormat,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
      },
    })
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw)

      switch (msg.type) {
        case 'response.audio.delta':
          if (msg.delta) {
            this.config.onAudio(msg.delta)
          }
          break

        case 'response.audio_transcript.done':
          if (msg.transcript) {
            this.config.onOutputTranscript(msg.transcript)
          }
          break

        case 'conversation.item.input_audio_transcription.completed':
          if (msg.transcript) {
            this.config.onInputTranscript(msg.transcript)
          }
          break

        case 'error':
          console.error('[realtime] API error:', msg.error)
          this.config.onError(msg.error?.message || 'Unknown error')
          break

        case 'session.created':
        case 'session.updated':
          console.log(`[realtime] ${msg.type}`)
          break
      }
    } catch {
      // Ignore parse errors for non-JSON frames
    }
  }

  sendAudio(base64Audio: string): void {
    if (!this.connected) return
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    })
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  disconnect(): void {
    this.connected = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
