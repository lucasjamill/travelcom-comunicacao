import { AgentExample, AgentExampleTurn, AgentExpectedOutput } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

interface HardcodedExample {
  label: string
  language_code: string
  scenario_type: string
  turns: AgentExampleTurn[]
  expected_output: AgentExpectedOutput
}

const HARDCODED_EXAMPLES: HardcodedExample[] = [
  {
    label: 'Confirmação normal - Japão',
    language_code: 'ja',
    scenario_type: 'confirmed',
    turns: [
      { role: 'agent', text: 'もしもし、トラベルコムと申します。ブラジルの旅行代理店です。田中様の予約を確認したいのですが...' },
      { role: 'hotel', text: 'はい、少々お待ちください... 田中様、チェックイン12月15日、チェックアウト12月18日、スタンダードルームですね。確認できました。' },
      { role: 'agent', text: 'ありがとうございます。確認番号をいただけますか？' },
      { role: 'hotel', text: 'はい、確認番号はHTL-2024-8842です。' },
    ],
    expected_output: {
      speak: 'ありがとうございます。HTL-2024-8842、承知しました。ご協力に感謝します。良い一日を。',
      speak_pt: 'Obrigado. HTL-2024-8842, entendido. Agradeço a cooperação. Tenha um bom dia.',
      status: 'confirmed',
      confirmation_number: 'HTL-2024-8842',
      should_hangup: true,
    },
  },
  {
    label: 'Reserva não encontrada - China',
    language_code: 'zh',
    scenario_type: 'not_found',
    turns: [
      { role: 'agent', text: '您好，我是巴西旅行社TravelCom。我想确认王先生的预订...' },
      { role: 'hotel', text: '对不起，我们系统里没有找到这个预订。' },
      { role: 'agent', text: '好的，能否按照入住日期12月20日查询？' },
      { role: 'hotel', text: '很抱歉，12月20日也没有这个名字的预订。' },
    ],
    expected_output: {
      speak: '非常感谢您的帮助。我们会重新核实并再次联系。再见。',
      speak_pt: 'Muito obrigado pela ajuda. Vamos verificar novamente e entrar em contato. Até logo.',
      status: 'not_found',
      confirmation_number: null,
      should_hangup: true,
    },
  },
  {
    label: 'Transferência de setor',
    language_code: 'en',
    scenario_type: 'transfer',
    turns: [
      { role: 'agent', text: "Good morning, this is TravelCom travel agency from Brazil. I'd like to confirm a reservation for Mr. Johnson..." },
      { role: 'hotel', text: "Please hold, I'll transfer you to our reservations department." },
      { role: 'agent', text: 'Of course, thank you.' },
      { role: 'hotel', text: 'Reservations, how can I help you?' },
    ],
    expected_output: {
      speak: "Good morning, I'm calling from TravelCom, a travel agency in Brazil. I'd like to confirm reservation for Mr. Johnson, checking in December 15th...",
      speak_pt: 'Bom dia, estou ligando da TravelCom, agência de viagens do Brasil. Gostaria de confirmar a reserva do Sr. Johnson, check-in 15 de dezembro...',
      status: 'ongoing',
      confirmation_number: null,
      should_hangup: false,
    },
  },
  {
    label: 'Não entendeu - pede repetição',
    language_code: 'ja',
    scenario_type: 'unclear',
    turns: [
      { role: 'agent', text: 'もしもし、トラベルコムです。山田様の予約確認でお電話しました。' },
      { role: 'hotel', text: '[áudio incompreensível / ruído]' },
    ],
    expected_output: {
      speak: 'すみません、よく聞こえませんでした。もう一度おっしゃっていただけますか？',
      speak_pt: 'Desculpe, não ouvi bem. Poderia repetir por favor?',
      status: 'ongoing',
      confirmation_number: null,
      should_hangup: false,
    },
  },
]

export function buildFewShotContext(examples?: HardcodedExample[]): string {
  const exampleList = examples || HARDCODED_EXAMPLES
  return exampleList
    .map(
      (example, i) => `
### Exemplo ${i + 1}: ${example.label}
Conversa:
${example.turns.map((t) => `[${t.role.toUpperCase()}]: ${t.text}`).join('\n')}

Resposta esperada:
${JSON.stringify(example.expected_output, null, 2)}
`
    )
    .join('\n---\n')
}

export async function loadDynamicExamples(): Promise<HardcodedExample[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('agent_examples')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error || !data?.length) {
      return HARDCODED_EXAMPLES
    }

    const dynamicExamples: HardcodedExample[] = (data as AgentExample[]).map((ex) => ({
      label: ex.label,
      language_code: ex.language_code,
      scenario_type: ex.scenario_type,
      turns: ex.conversation_turns,
      expected_output: ex.expected_output,
    }))

    return [...HARDCODED_EXAMPLES, ...dynamicExamples]
  } catch {
    return HARDCODED_EXAMPLES
  }
}
