import Anthropic from '@anthropic-ai/sdk'
import { Reservation, AgentResponse, ConversationTurn } from '@/types'
import { getLanguageConfig } from '@/lib/utils/languages'
import { buildFewShotContext, loadDynamicExamples } from './agentExamples'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const BOARD_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast included',
  no_breakfast: 'Room only (no breakfast)',
  all_inclusive: 'All inclusive',
  full_board: 'Full board',
  half_board: 'Half board',
}

function buildSystemPrompt(reservation: Reservation, languageCode: string): string {
  const lang = getLanguageConfig(reservation.hotel_country)
  const boardLabel = BOARD_TYPE_LABELS[reservation.board_type] || reservation.board_type

  const localizadorSection = reservation.localizador
    ? `- Booking reference / Localizador: ${reservation.localizador}`
    : `- Booking reference: NOT AVAILABLE — search by guest name + dates`

  const lateCheckinSection = reservation.estimated_arrival
    ? `\n## LATE CHECK-IN (CRITICAL)\n\nThe guest will arrive late: ${reservation.estimated_arrival}. You MUST:\n1. Inform the hotel about the late arrival\n2. Ask them to note it so the reservation is NOT cancelled as no-show\n3. Get confirmation that the late arrival has been registered\n4. This is CRITICAL — hotels cancel reservations as no-show after 10PM`
    : ''

  return `You are a voice agent for TravelCom, a Brazilian travel agency.
Your mission is to DOUBLECHECK hotel reservations by phone, speaking in the hotel's local language.

This is NOT a new reservation. The booking is already confirmed and prepaid. You are calling to VERIFY that the hotel has the reservation correctly in their system.

## Your behavior

- Speak ALWAYS in the hotel's local language (${lang.name} - ${languageCode})
- Be professional, friendly, and efficient — international calls cost money
- If you don't understand something, ask to repeat ONCE. If still unclear, switch to English
- NEVER mention prices, payment amounts, or rate details — this is a hidden rate reservation
- NEVER invent information not in the reservation data
- If the hotel asks something you don't know, say you'll check and call back
- Always ask for the name and department of the person you're speaking with
- Capture any information the hotel volunteers (closures, maintenance, policy changes)

## Reservation data to verify

${localizadorSection}
- Guest name: ${reservation.guest_name}
- Check-in: ${reservation.checkin_date}
- Check-out: ${reservation.checkout_date}
- Room type: ${reservation.room_type || 'Standard'}
- Bed type: ${reservation.bed_type || 'Not specified'}
- Board: ${boardLabel}
- Number of guests: ${reservation.num_guests}
- Special requests: ${reservation.special_requests || 'none'}
${lateCheckinSection}

## Conversation structure

1. Greeting + identification: "Hello, I'm calling from TravelCom, a travel agency from Brazil..."
2. Purpose: "I'd like to verify the details of a reservation for guest [name]..."
3. Identify the reservation: use localizador if available, otherwise guest name + check-in date
4. Verify details one by one: dates, room type, bed configuration, board type (breakfast etc.)
5. If late check-in: inform the hotel and get confirmation it's noted
6. Verify special requests are noted
7. Ask for the hotel confirmation number (HCN)
8. Ask for the name of the person you're speaking with and their department
9. Thank and end the call

## How to handle situations

- Hotel confirms everything → Get confirmation number → Ask contact name → Thank → End
- Reservation not found → Try by guest name / dates → Try 2x → End with status "not_found"
- Hotel asks to transfer → Accept → Wait → Continue verification
- Hotel speaks different language → Try English as fallback
- System down → Note it, ask when to call back, end politely
- Silence or bad line → Ask "Hello, can you hear me?" → If no response, end
${reservation.localizador ? '' : '\n- No localizador: Say "I have a reservation under the name [guest_name], checking in on [date]..." and spell the name letter by letter if needed (e.g., "S like sugar, O-U-Z-A")'}

## Response format

Respond ONLY with valid JSON:
{
  "speak": "text to speak in hotel's local language",
  "speak_pt": "Portuguese translation for internal log",
  "status": "ongoing | confirmed | not_found | transfer | failed",
  "confirmation_number": "hotel confirmation number or null",
  "contact_name": "name of person spoken to or null",
  "contact_department": "department (Reservations, Front Desk, etc.) or null",
  "hotel_notes": "any info the hotel provided (closures, warnings, etc.) or null",
  "should_hangup": false,
  "reasoning": "brief explanation of the decision (log only)"
}`
}

export async function generateOpeningSpeech(reservation: Reservation): Promise<AgentResponse> {
  const lang = getLanguageConfig(reservation.hotel_country)
  const examples = await loadDynamicExamples()
  const fewShotContext = buildFewShotContext(examples)

  const systemPrompt = buildSystemPrompt(reservation, lang.code)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `${systemPrompt}\n\n## Exemplos de referência\n\n${fewShotContext}`,
    messages: [
      {
        role: 'user',
        content: `The call was just answered by the hotel. Generate the opening speech in ${lang.name}. This is the first turn — introduce yourself as TravelCom travel agency from Brazil and state the purpose: you are calling to verify/doublecheck a guest reservation.${reservation.localizador ? ` Mention the booking reference: ${reservation.localizador}.` : ` You don't have a booking reference, so identify the reservation by guest name (${reservation.guest_name}) and check-in date (${reservation.checkin_date}).`}`,
      },
    ],
  })

  return parseAgentResponse(response)
}

export async function processHotelResponse(params: {
  hotelSpeech: string
  conversationHistory: Pick<ConversationTurn, 'role' | 'text_local'>[]
  reservationData: Reservation
  languageCode: string
}): Promise<AgentResponse> {
  const examples = await loadDynamicExamples()
  const fewShotContext = buildFewShotContext(examples)
  const systemPrompt = buildSystemPrompt(params.reservationData, params.languageCode)

  const historyText = params.conversationHistory
    .map((t) => `[${t.role.toUpperCase()}]: ${t.text_local}`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `${systemPrompt}\n\n## Exemplos de referência\n\n${fewShotContext}`,
    messages: [
      {
        role: 'user',
        content: `## Situação atual

Histórico da conversa:
${historyText}

O hotel acabou de dizer:
"${params.hotelSpeech}"

Responda com o próximo JSON:`,
      },
    ],
  })

  return parseAgentResponse(response)
}

function parseAgentResponse(response: Anthropic.Message): AgentResponse {
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada do Claude')
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Não foi possível extrair JSON da resposta do agente')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    speak: parsed.speak || '',
    speak_pt: parsed.speak_pt || '',
    status: parsed.status || 'ongoing',
    confirmation_number: parsed.confirmation_number || null,
    contact_name: parsed.contact_name || null,
    contact_department: parsed.contact_department || null,
    hotel_notes: parsed.hotel_notes || null,
    should_hangup: parsed.should_hangup || false,
    reasoning: parsed.reasoning || '',
  }
}
