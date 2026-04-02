export type BoardType = 'breakfast' | 'no_breakfast' | 'all_inclusive' | 'full_board' | 'half_board'

export interface Reservation {
  id: string
  localizador: string | null
  guest_name: string
  hotel_name: string
  hotel_phone: string
  hotel_country: string
  hotel_language: string
  checkin_date: string
  checkout_date: string
  room_type: string | null
  bed_type: string | null
  board_type: BoardType
  num_guests: number
  estimated_arrival: string | null
  prepayment_status: 'paid' | 'pending' | 'partial'
  prepayment_amount: number | null
  prepayment_currency: string
  special_requests: string | null
  status: 'pending' | 'calling' | 'confirmed' | 'failed' | 'review_needed'
  created_at: string
  updated_at: string
}

export type CallMode = 'live_translation' | 'ai_agent'

export interface Call {
  id: string
  reservation_id: string
  telnyx_call_control_id: string | null
  telnyx_call_leg_id: string | null
  call_mode: CallMode
  operator_language: string
  status: 'initiated' | 'in_progress' | 'completed' | 'failed'
  duration_seconds: number | null
  recording_url: string | null
  recording_url_original: string | null
  recording_url_translated: string | null
  transcript_pt: string | null
  transcript_local: string | null
  confirmation_number: string | null
  contact_name: string | null
  contact_department: string | null
  hotel_notes: string | null
  agent_notes: string | null
  error_message: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface CallScript {
  id: string
  reservation_id: string
  language_code: string
  script_pt: string
  script_local: string
  audio_url: string | null
  created_at: string
}

export interface ConversationTurn {
  id: string
  call_id: string
  turn_number: number
  role: 'agent' | 'hotel'
  text_local: string
  text_pt: string | null
  audio_url: string | null
  created_at: string
}

export interface AgentExample {
  id: string
  label: string
  language_code: string
  scenario_type: 'confirmed' | 'not_found' | 'transfer' | 'unclear' | 'special_request'
  conversation_turns: AgentExampleTurn[]
  expected_output: AgentExpectedOutput
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface AgentExampleTurn {
  role: 'agent' | 'hotel'
  text: string
}

export interface AgentExpectedOutput {
  speak: string
  speak_pt: string
  status: ConversationStatus
  confirmation_number: string | null
  should_hangup: boolean
}

export type ConversationStatus = 'ongoing' | 'confirmed' | 'not_found' | 'transfer' | 'failed'

export interface GeneratedScript {
  language_code: string
  language_name: string
  script_pt: string
  script_local: string
  key_phrases: { pt: string; local: string }[]
  fallback_english: string
}

export interface AgentResponse {
  speak: string
  speak_pt: string
  status: ConversationStatus
  confirmation_number: string | null
  contact_name: string | null
  contact_department: string | null
  hotel_notes: string | null
  should_hangup: boolean
  reasoning: string
}

export interface ReservationWithCalls extends Reservation {
  calls: Call[]
  call_scripts: CallScript[]
}

export type ReservationInsert = Omit<Reservation, 'id' | 'created_at' | 'updated_at' | 'status'>
export type ReservationUpdate = Partial<Omit<Reservation, 'id' | 'created_at' | 'updated_at'>>
