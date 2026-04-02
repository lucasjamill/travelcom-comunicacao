import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { initiateStreamingCall } from '@/lib/telnyx/client'
import { getE164 } from '@/lib/utils/phoneFormatter'
import { getLanguageConfig } from '@/lib/utils/languages'
import { v4 as uuidv4 } from 'uuid'
import { Reservation } from '@/types'

export const maxDuration = 30

const BRIDGE_SERVER_URL = process.env.BRIDGE_SERVER_URL || 'http://localhost:8080'

function getBridgeWsUrl(): string {
  return BRIDGE_SERVER_URL.replace(/^http/, 'ws')
}

export async function POST(request: NextRequest) {
  try {
    const { reservation_id, operator_language } = await request.json()

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

    const res = reservation as Reservation
    const langConfig = getLanguageConfig(res.hotel_country)
    const sessionId = uuidv4()
    const opLang = operator_language || 'pt'

    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        reservation_id,
        call_mode: 'live_translation',
        operator_language: opLang,
        status: 'initiated',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 })
    }

    // Register session on the bridge server
    const bridgeRes = await fetch(`${BRIDGE_SERVER_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.BRIDGE_API_SECRET
          ? { Authorization: `Bearer ${process.env.BRIDGE_API_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        session_id: sessionId,
        hotel_language: langConfig.code,
        operator_language: opLang,
        reservation_id,
        call_id: call.id,
      }),
    })

    if (!bridgeRes.ok) {
      const err = await bridgeRes.text()
      console.error('[live/initiate] Bridge session creation failed:', err)
      return NextResponse.json({ error: 'Erro ao criar sessão de tradução' }, { status: 502 })
    }

    await supabase
      .from('reservations')
      .update({ status: 'calling' })
      .eq('id', reservation_id)

    const phoneNumber = getE164(res.hotel_phone, res.hotel_country) || res.hotel_phone
    const bridgeStreamUrl = `${getBridgeWsUrl()}/telnyx-stream?session=${sessionId}`

    const callData = await initiateStreamingCall({
      toNumber: phoneNumber,
      reservationId: reservation_id,
      sessionId,
      bridgeStreamUrl,
    }) as unknown as Record<string, unknown>

    await supabase
      .from('calls')
      .update({
        telnyx_call_control_id: (callData.call_control_id as string) || null,
        telnyx_call_leg_id: (callData.call_leg_id as string) || null,
      })
      .eq('id', call.id)

    const bridgeWsUrl = `${getBridgeWsUrl()}/live-call?session=${sessionId}`

    return NextResponse.json({
      call_id: call.id,
      session_id: sessionId,
      bridge_ws_url: bridgeWsUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada'
    console.error('[live/initiate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
