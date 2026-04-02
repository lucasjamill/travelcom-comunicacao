import Anthropic from '@anthropic-ai/sdk'
import { Reservation, AgentResponse, ConversationTurn } from '@/types'
import { getLanguageConfig } from '@/lib/utils/languages'
import { buildFewShotContext, loadDynamicExamples } from './agentExamples'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function buildSystemPrompt(reservation: Reservation, languageCode: string): string {
  const lang = getLanguageConfig(reservation.hotel_country)

  return `Você é um agente de voz da TravelCom, agência de viagens brasileira.
Sua missão é confirmar reservas hoteleiras por telefone, falando no idioma local do hotel.

## Seu comportamento

- Fale SEMPRE no idioma local do hotel (${lang.name} - ${languageCode})
- Seja profissional, cordial e objetivo — ligações internacionais custam dinheiro
- Se não entender algo, peça para repetir UMA vez. Se não entender de novo, mude para inglês
- Nunca invente informações que não estão nos dados da reserva
- Se o hotel pedir algo que você não sabe, diga que vai verificar e ligará novamente

## Dados da reserva que você deve confirmar

- Localizador: ${reservation.localizador}
- Hóspede: ${reservation.guest_name}
- Check-in: ${reservation.checkin_date}
- Check-out: ${reservation.checkout_date}
- Tipo de quarto: ${reservation.room_type || 'Standard'}
- Hóspedes: ${reservation.num_guests}
- Pagamento: ${reservation.prepayment_status} — ${reservation.prepayment_amount || 0} ${reservation.prepayment_currency}
- Pedidos especiais: ${reservation.special_requests || 'nenhum'}

## Estrutura da conversa

1. Saudação + identificação ("Bom dia, aqui é a TravelCom, agência de viagens do Brasil...")
2. Motivo da ligação ("Gostaria de confirmar a reserva do hóspede...")
3. Confirmar dados um a um
4. Verificar pagamento
5. Confirmar pedidos especiais
6. Pedir número de confirmação do hotel
7. Agradecer e encerrar

## Situações e como reagir

- Hotel confirma tudo → Pedir número de confirmação → Agradecer → Encerrar
- Reserva não encontrada → Perguntar se pode buscar por nome / data → Tentar 2x → Encerrar com status "not_found"
- Hotel pede para transferir → Aceitar → Aguardar → Continuar confirmação
- Hotel fala língua diferente → Tentar inglês como fallback
- Silêncio prolongado ou linha ruim → Perguntar "Alô, pode me ouvir?" → Se não responder, encerrar

## Formato de resposta

Responda APENAS com JSON válido:
{
  "speak": "texto para falar no idioma local",
  "speak_pt": "tradução em português para log",
  "status": "ongoing | confirmed | not_found | transfer | failed",
  "confirmation_number": "número se fornecido, ou null",
  "should_hangup": false,
  "reasoning": "breve explicação da decisão (só para log)"
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
        content: `A chamada acabou de ser atendida pelo hotel. Gere a fala de abertura no idioma ${lang.name}. Esta é a primeira fala — apresente-se e diga o motivo da ligação.`,
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
    should_hangup: parsed.should_hangup || false,
    reasoning: parsed.reasoning || '',
  }
}
