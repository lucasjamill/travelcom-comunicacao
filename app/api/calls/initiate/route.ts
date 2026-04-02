import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { initiateCall } from '@/lib/telnyx/client'
import { getE164 } from '@/lib/utils/phoneFormatter'
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
      .select('*, call_scripts(*)')
      .eq('id', reservation_id)
      .single()

    if (resError || !reservation) {
      return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
    }

    const res = reservation as Reservation & { call_scripts: { audio_url: string }[] }

    const latestScript = res.call_scripts?.sort(
      (a: { audio_url: string }, b: { audio_url: string }) =>
        (b as unknown as { created_at: string }).created_at > (a as unknown as { created_at: string }).created_at ? 1 : -1
    )[0]

    const phoneNumber = getE164(res.hotel_phone, res.hotel_country) || res.hotel_phone

    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        reservation_id,
        status: 'initiated',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 })
    }

    await supabase
      .from('reservations')
      .update({ status: 'calling' })
      .eq('id', reservation_id)

    const callData = await initiateCall({
      toNumber: phoneNumber,
      reservationId: reservation_id,
      audioUrl: latestScript?.audio_url || '',
    }) as unknown as Record<string, unknown>

    await supabase
      .from('calls')
      .update({
        telnyx_call_control_id: (callData.call_control_id as string) || null,
        telnyx_call_leg_id: (callData.call_leg_id as string) || null,
      })
      .eq('id', call.id)

    return NextResponse.json({ call_id: call.id, telnyx_call: callData })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
