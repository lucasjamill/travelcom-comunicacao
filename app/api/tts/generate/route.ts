import { NextRequest, NextResponse } from 'next/server'
import { synthesizeAndStore } from '@/lib/openai/tts'

export async function POST(request: NextRequest) {
  try {
    const { text, language_code, prefix } = await request.json()

    if (!text || !language_code) {
      return NextResponse.json(
        { error: 'text e language_code são obrigatórios' },
        { status: 400 }
      )
    }

    const audioUrl = await synthesizeAndStore(text, language_code, prefix || 'tts')

    return NextResponse.json({ audio_url: audioUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar áudio'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
