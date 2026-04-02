import Anthropic from '@anthropic-ai/sdk'
import { Reservation, GeneratedScript } from '@/types'
import { getLanguageConfig } from '@/lib/utils/languages'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SCRIPT_SYSTEM_PROMPT = `Você é um assistente especializado em confirmação de reservas hoteleiras internacionais.
Sua tarefa é gerar um roteiro de ligação telefônica profissional e natural.

O roteiro deve:
1. Ser gerado em DOIS idiomas: Português (para referência do operador) e o idioma local do hotel
2. Ter uma estrutura clara: Saudação → Identificação → Confirmação de dados → Verificação de pagamento → Pedidos especiais → Encerramento
3. Incluir variações para possíveis respostas do hotel (confirmado / não encontrado / transferir para outro setor)
4. Ser natural e profissional, como uma ligação real de agência de viagens
5. Incluir como pedir o número de confirmação do hotel

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "language_code": "código do idioma",
  "language_name": "nome do idioma em português",
  "script_pt": "roteiro completo em português...",
  "script_local": "roteiro completo no idioma local...",
  "key_phrases": [
    {"pt": "frase em português", "local": "frase no idioma local"},
  ],
  "fallback_english": "roteiro completo em inglês caso o idioma local falhe"
}`

export async function generateCallScript(reservation: Reservation): Promise<GeneratedScript> {
  const langConfig = getLanguageConfig(reservation.hotel_country)

  const userPrompt = `Gere o roteiro de ligação para confirmar esta reserva:

- Localizador: ${reservation.localizador}
- Hóspede: ${reservation.guest_name}
- Hotel: ${reservation.hotel_name}
- País: ${reservation.hotel_country}
- Idioma do hotel: ${langConfig.name} (${langConfig.code})
- Check-in: ${reservation.checkin_date}
- Check-out: ${reservation.checkout_date}
- Tipo de quarto: ${reservation.room_type || 'Standard'}
- Hóspedes: ${reservation.num_guests}
- Pagamento: ${reservation.prepayment_status} — ${reservation.prepayment_amount || 0} ${reservation.prepayment_currency}
- Pedidos especiais: ${reservation.special_requests || 'nenhum'}

O roteiro deve ser no idioma: ${langConfig.name} (${langConfig.code})`

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
