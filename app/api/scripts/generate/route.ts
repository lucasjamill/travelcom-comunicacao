import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCallScript } from '@/lib/claude/scriptGenerator'
import { synthesizeAndStore } from '@/lib/google/tts'
import { Reservation } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { reservation_id } = await request.json()

    if (!reservation_id) {
      return NextResponse.json({ error: 'reservation_id é obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservation_id)
      .single()

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
    }

    const script = await generateCallScript(reservation as Reservation)

    const audioUrl = await synthesizeAndStore(
      script.script_local,
      script.language_code,
      `scripts/${reservation_id}`
    )

    const { data: savedScript, error: saveError } = await supabase
      .from('call_scripts')
      .insert({
        reservation_id,
        language_code: script.language_code,
        script_pt: script.script_pt,
        script_local: script.script_local,
        audio_url: audioUrl,
      })
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({
      script: savedScript,
      key_phrases: script.key_phrases,
      fallback_english: script.fallback_english,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar roteiro'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
