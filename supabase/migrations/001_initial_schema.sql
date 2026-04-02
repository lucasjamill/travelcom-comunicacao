-- Reservations
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  localizador TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  hotel_phone TEXT NOT NULL,
  hotel_country TEXT NOT NULL,
  hotel_language TEXT NOT NULL,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  room_type TEXT,
  num_guests INTEGER DEFAULT 1,
  prepayment_status TEXT DEFAULT 'paid',
  prepayment_amount DECIMAL(10,2),
  prepayment_currency TEXT DEFAULT 'BRL',
  special_requests TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  telnyx_call_control_id TEXT,
  telnyx_call_leg_id TEXT,
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript_pt TEXT,
  transcript_local TEXT,
  confirmation_number TEXT,
  agent_notes TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call scripts
CREATE TABLE call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  script_pt TEXT NOT NULL,
  script_local TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation turns
CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL,
  text_local TEXT NOT NULL,
  text_pt TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent examples (few-shot)
CREATE TABLE agent_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  language_code TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  conversation_turns JSONB NOT NULL,
  expected_output JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_checkin ON reservations(checkin_date);
CREATE INDEX idx_reservations_country ON reservations(hotel_country);
CREATE INDEX idx_calls_reservation ON calls(reservation_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_conversation_turns_call ON conversation_turns(call_id);
CREATE INDEX idx_call_scripts_reservation ON call_scripts(reservation_id);
CREATE INDEX idx_agent_examples_active ON agent_examples(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_examples ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow authenticated users full access — internal tool)
CREATE POLICY "Authenticated users full access" ON reservations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON calls FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON call_scripts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON conversation_turns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON agent_examples FOR ALL USING (auth.role() = 'authenticated');

-- Service role bypass for API routes
CREATE POLICY "Service role bypass" ON reservations FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass" ON calls FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass" ON call_scripts FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass" ON conversation_turns FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role bypass" ON agent_examples FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
