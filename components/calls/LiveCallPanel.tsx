'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Phone, PhoneOff, Mic, MicOff, Loader2, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LiveTranscript, TranscriptEntry } from './LiveTranscript'

type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended'

interface LiveCallPanelProps {
  reservationId: string
  hotelName: string
  hotelLanguage: string
  hotelLanguageName: string
}

const SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

export function LiveCallPanel({
  reservationId,
  hotelName,
  hotelLanguage,
  hotelLanguageName,
}: LiveCallPanelProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [muted, setMuted] = useState(false)
  const [operatorLanguage, setOperatorLanguage] = useState('pt')
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const nextPlayTimeRef = useRef(0)

  const cleanup = useCallback(() => {
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
    }
    audioContextRef.current = null

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'hangup' }))
      wsRef.current.close()
    }
    wsRef.current = null

    playbackQueueRef.current = []
    isPlayingRef.current = false
    nextPlayTimeRef.current = 0
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const playAudioChunk = useCallback((pcm16Buffer: ArrayBuffer) => {
    const ctx = audioContextRef.current
    if (!ctx || ctx.state === 'closed') return

    const int16 = new Int16Array(pcm16Buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    // Resample from 24kHz to AudioContext sample rate
    const ratio = ctx.sampleRate / SAMPLE_RATE
    const outputLength = Math.round(float32.length * ratio)
    const resampled = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i / ratio
      const low = Math.floor(srcIndex)
      const high = Math.min(low + 1, float32.length - 1)
      const frac = srcIndex - low
      resampled[i] = float32[low] * (1 - frac) + float32[high] * frac
    }

    const buffer = ctx.createBuffer(1, resampled.length, ctx.sampleRate)
    buffer.getChannelData(0).set(resampled)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    const startTime = Math.max(now, nextPlayTimeRef.current)
    source.start(startTime)
    nextPlayTimeRef.current = startTime + buffer.duration
  }, [])

  const startCall = useCallback(async () => {
    setCallState('connecting')
    setErrorMessage(null)
    setTranscriptEntries([])

    try {
      const res = await fetch('/api/calls/live/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservationId,
          operator_language: operatorLanguage,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || 'Erro ao iniciar chamada')
      }

      const { bridge_ws_url } = await res.json()

      // Set up audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: SAMPLE_RATE },
      })
      mediaStreamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = audioCtx

      // Connect WebSocket
      const ws = new WebSocket(bridge_ws_url)
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        setCallState('ringing')

        // Set up mic capture with ScriptProcessor (AudioWorklet requires served files)
        const source = audioCtx.createMediaStreamSource(stream)
        const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1)

        processor.onaudioprocess = (e) => {
          if (muted || ws.readyState !== WebSocket.OPEN) return

          const input = e.inputBuffer.getChannelData(0)
          const pcm16 = new Int16Array(input.length)
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          ws.send(pcm16.buffer)
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
        workletNodeRef.current = processor as unknown as AudioWorkletNode
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudioChunk(event.data)
        } else {
          try {
            const msg = JSON.parse(event.data)

            switch (msg.type) {
              case 'translation_active':
                setCallState('active')
                toast.success('Tradução ativa — pode falar!')
                break

              case 'transcript':
                setTranscriptEntries((prev) => [
                  ...prev,
                  {
                    role: msg.role,
                    text: msg.text,
                    language: msg.language,
                    timestamp: Date.now(),
                  },
                ])
                break

              case 'call_ended':
                setCallState('ended')
                toast.info('Chamada encerrada')
                cleanup()
                break

              case 'error':
                setErrorMessage(msg.message)
                toast.error(msg.message, { duration: 6000 })
                break
            }
          } catch { /* ignore non-JSON */ }
        }
      }

      ws.onclose = () => {
        if (callState !== 'ended' && callState !== 'idle') {
          setCallState('ended')
          cleanup()
        }
      }

      ws.onerror = () => {
        toast.error('Erro na conexão com o servidor de tradução')
        setCallState('idle')
        cleanup()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada'
      toast.error(message, { duration: 6000 })
      setCallState('idle')
      cleanup()
    }
  }, [reservationId, operatorLanguage, muted, cleanup, playAudioChunk, callState])

  const endCall = useCallback(() => {
    setCallState('ended')
    cleanup()
    toast.info('Chamada encerrada')
  }, [cleanup])

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4" />
            Chamada com Tradução — {hotelName}
          </CardTitle>
          {callState === 'active' && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-xs text-green-600 font-medium">Tradução ativa</span>
            </div>
          )}
          {callState === 'ringing' && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Chamando...
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3">
          {callState === 'idle' || callState === 'ended' ? (
            <>
              <Select value={operatorLanguage} onValueChange={(v) => v && setOperatorLanguage(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seu idioma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={startCall}
                disabled={callState === 'connecting' as CallState}
                className="bg-green-600 hover:bg-green-700"
              >
                <Phone className="h-4 w-4 mr-2" />
                Ligar com Tradução
              </Button>
            </>
          ) : callState === 'connecting' ? (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Conectando...
            </Button>
          ) : (
            <>
              <Button
                variant={muted ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleMute}
                title={muted ? 'Ativar microfone' : 'Silenciar microfone'}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button variant="destructive" onClick={endCall}>
                <PhoneOff className="h-4 w-4 mr-2" />
                Desligar
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {operatorLanguage.toUpperCase()} ↔ {hotelLanguage.toUpperCase()} ({hotelLanguageName})
              </span>
            </>
          )}
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="bg-red-50 text-red-700 rounded-md p-3 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Transcript */}
        {(callState === 'active' || callState === 'ringing' || callState === 'ended') && (
          <div className="border rounded-md min-h-[200px]">
            <LiveTranscript
              entries={transcriptEntries}
              operatorLanguage={operatorLanguage}
              hotelLanguage={hotelLanguage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
