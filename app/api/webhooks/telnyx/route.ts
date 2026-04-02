import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseClientState } from '@/lib/telnyx/client'
import crypto from 'crypto'

export const maxDuration = 30

function verifyTelnyxSignature(payload: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true

  if (!signature || !timestamp) return false

  const signedPayload = `${timestamp}|${payload}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    const signature = request.headers.get('telnyx-signature-ed25519')
    const timestamp = request.headers.get('telnyx-timestamp')

    if (process.env.WEBHOOK_SECRET && !verifyTelnyxSignature(rawBody, signature, timestamp)) {
      console.error('Invalid Telnyx webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const event = body.data
    const eventType = event?.event_type

    if (!eventType) {
      return NextResponse.json({ received: true })
    }

    const callControlId = event.payload?.call_control_id
    const clientState = event.payload?.client_state
      ? parseClientState(event.payload.client_state)
      : {}

    const supabase = createServiceClient()

    switch (eventType) {
      case 'call.initiated': {
        await supabase
          .from('calls')
          .update({ status: 'in_progress' })
          .eq('telnyx_call_control_id', callControlId)
        break
      }

      case 'call.answered': {
        console.log(`[webhook] Call answered: ${callControlId}, mode: ${clientState.call_mode || 'unknown'}`)
        break
      }

      case 'call.recording.saved': {
        const recordingUrl = event.payload?.recording_urls?.mp3
        if (recordingUrl && callControlId) {
          await supabase
            .from('calls')
            .update({ recording_url: recordingUrl })
            .eq('telnyx_call_control_id', callControlId)
          console.log(`[webhook] Recording saved for call ${callControlId}`)
        }
        break
      }

      case 'call.hangup': {
        const { data: call } = await supabase
          .from('calls')
          .select('id, reservation_id, started_at')
          .eq('telnyx_call_control_id', callControlId)
          .single()

        if (call) {
          const endedAt = new Date()
          const startedAt = call.started_at ? new Date(call.started_at) : endedAt
          const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

          await supabase
            .from('calls')
            .update({
              status: 'completed',
              ended_at: endedAt.toISOString(),
              duration_seconds: durationSeconds,
            })
            .eq('id', call.id)

          const { data: resCheck } = await supabase
            .from('reservations')
            .select('status')
            .eq('id', call.reservation_id)
            .single()

          if (resCheck?.status === 'calling') {
            await supabase
              .from('reservations')
              .update({ status: 'review_needed' })
              .eq('id', call.reservation_id)
          }

          console.log(`[webhook] Call hangup: ${callControlId}, duration: ${durationSeconds}s`)
        }
        break
      }

      case 'streaming.started': {
        console.log(`[webhook] Media streaming started for call ${callControlId}`)
        break
      }

      case 'streaming.stopped': {
        console.log(`[webhook] Media streaming stopped for call ${callControlId}`)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}
