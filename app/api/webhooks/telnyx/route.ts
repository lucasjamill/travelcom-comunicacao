import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseClientState, playAudio, startGather, hangup } from '@/lib/telnyx/client'
import { generateOpeningSpeech, processHotelResponse } from '@/lib/claude/conversationAgent'
import { synthesizeAndStore } from '@/lib/google/tts'
import { transcribeFromUrl } from '@/lib/google/stt'
import { Reservation } from '@/types'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
        const reservationId = clientState.reservation_id as string
        if (!reservationId) break

        const { data: reservation } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single()

        if (!reservation) break

        const opening = await generateOpeningSpeech(reservation as Reservation)

        const audioUrl = await synthesizeAndStore(
          opening.speak,
          (reservation as Reservation).hotel_language,
          `calls/${reservationId}`
        )

        const { data: call } = await supabase
          .from('calls')
          .select('id')
          .eq('telnyx_call_control_id', callControlId)
          .single()

        if (call) {
          await supabase.from('conversation_turns').insert({
            call_id: call.id,
            turn_number: 1,
            role: 'agent',
            text_local: opening.speak,
            text_pt: opening.speak_pt,
            audio_url: audioUrl,
          })
        }

        await playAudio(callControlId, audioUrl)
        break
      }

      case 'call.playback.ended': {
        const reservationId = clientState.reservation_id as string
        if (!reservationId) break

        const { data: reservation } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single()

        if (reservation) {
          await startGather(callControlId, (reservation as Reservation).hotel_language)
        }
        break
      }

      case 'call.gather.ended': {
        const reservationId = clientState.reservation_id as string
        if (!reservationId) break

        const { data: reservation } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single()

        if (!reservation) break

        const { data: call } = await supabase
          .from('calls')
          .select('id')
          .eq('telnyx_call_control_id', callControlId)
          .single()

        if (!call) break

        const gatherAudioUrl = event.payload?.recording_url
        let hotelSpeech = ''

        if (gatherAudioUrl) {
          hotelSpeech = await transcribeFromUrl(
            gatherAudioUrl,
            (reservation as Reservation).hotel_language
          )
        } else if (event.payload?.digits) {
          hotelSpeech = event.payload.digits
        }

        if (!hotelSpeech) {
          hotelSpeech = '[silêncio ou áudio não capturado]'
        }

        const { data: existingTurns } = await supabase
          .from('conversation_turns')
          .select('role, text_local')
          .eq('call_id', call.id)
          .order('turn_number', { ascending: true })

        const turnNumber = (existingTurns?.length || 0) + 1

        await supabase.from('conversation_turns').insert({
          call_id: call.id,
          turn_number: turnNumber,
          role: 'hotel',
          text_local: hotelSpeech,
          text_pt: null,
        })

        const agentResponse = await processHotelResponse({
          hotelSpeech,
          conversationHistory: existingTurns || [],
          reservationData: reservation as Reservation,
          languageCode: (reservation as Reservation).hotel_language,
        })

        const replyAudioUrl = await synthesizeAndStore(
          agentResponse.speak,
          (reservation as Reservation).hotel_language,
          `calls/${reservationId}`
        )

        await supabase.from('conversation_turns').insert({
          call_id: call.id,
          turn_number: turnNumber + 1,
          role: 'agent',
          text_local: agentResponse.speak,
          text_pt: agentResponse.speak_pt,
          audio_url: replyAudioUrl,
        })

        if (agentResponse.confirmation_number) {
          await supabase
            .from('calls')
            .update({ confirmation_number: agentResponse.confirmation_number })
            .eq('id', call.id)
        }

        if (agentResponse.should_hangup) {
          await playAudio(callControlId, replyAudioUrl)

          const finalStatus = agentResponse.status === 'confirmed' ? 'confirmed'
            : agentResponse.status === 'not_found' ? 'failed'
            : 'review_needed'

          await supabase
            .from('reservations')
            .update({ status: finalStatus })
            .eq('id', reservationId)

          await supabase
            .from('calls')
            .update({
              agent_notes: agentResponse.reasoning,
              status: 'completed',
            })
            .eq('id', call.id)

          setTimeout(async () => {
            try { await hangup(callControlId) } catch { /* call may have ended */ }
          }, 10000)
        } else {
          await playAudio(callControlId, replyAudioUrl)
        }
        break
      }

      case 'call.recording.saved': {
        const recordingUrl = event.payload?.recording_urls?.mp3
        if (recordingUrl && callControlId) {
          await supabase
            .from('calls')
            .update({ recording_url: recordingUrl })
            .eq('telnyx_call_control_id', callControlId)
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

          const { data: turns } = await supabase
            .from('conversation_turns')
            .select('role, text_local, text_pt')
            .eq('call_id', call.id)
            .order('turn_number', { ascending: true })

          if (turns?.length) {
            const transcriptLocal = turns
              .map((t) => `[${t.role.toUpperCase()}]: ${t.text_local}`)
              .join('\n')
            const transcriptPt = turns
              .filter((t) => t.text_pt)
              .map((t) => `[${t.role.toUpperCase()}]: ${t.text_pt}`)
              .join('\n')

            await supabase
              .from('calls')
              .update({
                transcript_local: transcriptLocal,
                transcript_pt: transcriptPt || null,
              })
              .eq('id', call.id)
          }

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
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}
