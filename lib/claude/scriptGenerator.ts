import Anthropic from '@anthropic-ai/sdk'
import { Reservation, GeneratedScript } from '@/types'
import { getLanguageConfig } from '@/lib/utils/languages'

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

const SCRIPT_SYSTEM_PROMPT = `You are a specialist in international hotel reservation verification (doublecheck).
Your task is to generate a professional, natural phone call script for verifying an existing hotel reservation.

This is NOT a new booking. The reservation is already confirmed and prepaid through a travel agency. The purpose is to DOUBLECHECK that the hotel has the reservation correctly in their system.

The script must:
1. Be generated in TWO languages: Portuguese (for the operator's reference) and the hotel's local language
2. Follow this structure: Greeting → Identification → Find the reservation → Verify details (dates, room, bed, board, special requests) → Late check-in if applicable → Ask for hotel confirmation number → Ask contact name → Thank and close
3. Include variations for common scenarios (confirmed / not found / transfer to another department / system down)
4. Be natural and professional, like a real travel agency call — based on how operators actually conduct doublecheck calls
5. NEVER mention prices, payment amounts, or rates
6. Include how to spell guest names letter by letter when needed (e.g., "S like sugar, O-U-Z-A")

Return ONLY valid JSON with the following structure:
{
  "language_code": "language code",
  "language_name": "language name in Portuguese",
  "script_pt": "complete script in Portuguese...",
  "script_local": "complete script in hotel's local language...",
  "key_phrases": [
    {"pt": "phrase in Portuguese", "local": "phrase in local language"},
  ],
  "fallback_english": "complete script in English as fallback"
}`

export async function generateCallScript(reservation: Reservation): Promise<GeneratedScript> {
  const langConfig = getLanguageConfig(reservation.hotel_country)

  const boardLabel = BOARD_TYPE_LABELS[reservation.board_type] || reservation.board_type

  const userPrompt = `Generate the doublecheck call script for this reservation:

- Booking reference: ${reservation.localizador || 'NOT AVAILABLE — identify by guest name + dates'}
- Guest name: ${reservation.guest_name}
- Hotel: ${reservation.hotel_name}
- Country: ${reservation.hotel_country}
- Hotel language: ${langConfig.name} (${langConfig.code})
- Check-in: ${reservation.checkin_date}
- Check-out: ${reservation.checkout_date}
- Room type: ${reservation.room_type || 'Standard'}
- Bed type: ${reservation.bed_type || 'Not specified'}
- Board: ${boardLabel}
- Number of guests: ${reservation.num_guests}
- Special requests: ${reservation.special_requests || 'none'}
${reservation.estimated_arrival ? `- LATE CHECK-IN: Guest arrives around ${reservation.estimated_arrival}. The script MUST include informing the hotel about the late arrival to prevent no-show cancellation.` : ''}

The script should be in: ${langConfig.name} (${langConfig.code})
DO NOT mention prices, payment amounts, or rates in the script.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SCRIPT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada da API Claude')
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Não foi possível extrair JSON da resposta')
  }

  return JSON.parse(jsonMatch[0]) as GeneratedScript
}
