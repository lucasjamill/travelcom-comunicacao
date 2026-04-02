import Telnyx from 'telnyx'

const telnyx = new Telnyx({ apiKey: process.env.TELNYX_API_KEY! })

export async function initiateCall(params: {
  toNumber: string
  reservationId: string
  audioUrl: string
}) {
  const call = await telnyx.calls.dial({
    connection_id: process.env.TELNYX_CONNECTION_ID!,
    to: params.toNumber,
    from: process.env.TELNYX_FROM_NUMBER!,
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`,
    record: 'record-from-answer',
    record_format: 'mp3',
    client_state: Buffer.from(
      JSON.stringify({
        reservation_id: params.reservationId,
        audio_url: params.audioUrl,
      })
    ).toString('base64'),
  } as Parameters<typeof telnyx.calls.dial>[0])

  return call
}

export async function playAudio(callControlId: string, audioUrl: string) {
  await telnyx.calls.actions.startPlayback(callControlId, {
    audio_url: audioUrl,
    client_state: Buffer.from(JSON.stringify({ type: 'playback' })).toString('base64'),
  } as Parameters<typeof telnyx.calls.actions.startPlayback>[1])
}

export async function startGather(callControlId: string, _languageCode: string) {
  await telnyx.calls.actions.gather(callControlId, {
    maximum_timeout_secs: 15,
    inter_digit_timeout_secs: 10,
    minimum_digits: 1,
    maximum_digits: 128,
    client_state: Buffer.from(
      JSON.stringify({ type: 'gather' })
    ).toString('base64'),
  } as Parameters<typeof telnyx.calls.actions.gather>[1])
}

export async function hangup(callControlId: string) {
  await telnyx.calls.actions.hangup(callControlId, {})
}

export function parseClientState(encoded: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString())
  } catch {
    return {}
  }
}
