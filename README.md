# TravelCom Comunicacao

AI-powered voice agent for international hotel reservation confirmation. The system autonomously calls hotels worldwide, speaks in their local language, confirms booking details in real-time, and records/transcribes the entire conversation.

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (serverless on Vercel)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **VoIP:** Telnyx Call Control v2
- **TTS:** Google Cloud Text-to-Speech
- **STT:** Google Cloud Speech-to-Text
- **LLM:** Claude API (Anthropic) — claude-sonnet-4-6
- **Hosting:** Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/lucasjamill/travelcom-comunicacao.git
cd travelcom-comunicacao
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Go to **Storage** and create a bucket called `call-audio` (set to **public**)
4. Go to **Authentication > Settings** and make sure email/password sign-in is enabled
5. Create your first user in **Authentication > Users > Add User**
6. Copy your project URL, anon key, and service role key from **Settings > API**

### 3. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Cloud Text-to-Speech API**
4. Enable **Cloud Speech-to-Text API**
5. Go to **IAM & Admin > Service Accounts**
6. Create a service account and download the JSON key
7. Base64-encode the JSON key for Vercel:

```bash
cat your-service-account.json | base64
```

### 4. Telnyx Setup

1. Create an account at [telnyx.com](https://telnyx.com)
2. Buy a phone number with international calling capability
3. Go to **Messaging > SIP Trunking > Outbound Voice Profiles** and create a connection
4. Note your:
   - API Key (from **Auth > API Keys**)
   - Connection ID
   - Phone number (E.164 format, e.g. `+15551234567`)
5. Set the webhook URL to your Vercel deployment:
   ```
   https://your-app.vercel.app/api/webhooks/telnyx
   ```

### 5. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TELNYX_API_KEY` | Telnyx API key |
| `TELNYX_CONNECTION_ID` | Telnyx connection/trunk ID |
| `TELNYX_FROM_NUMBER` | Telnyx phone number (E.164) |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Base64-encoded service account JSON |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |
| `WEBHOOK_SECRET` | Secret for webhook validation |

### 6. Deploy to Vercel

1. Push to GitHub (already done if you cloned)
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add all environment variables from the table above
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL
5. Deploy

### 7. Local Development

```bash
npm run dev
```

The app runs at `http://localhost:3000`. Note that Telnyx webhooks won't work locally — they require the Vercel production URL.

## Supported Languages

| Country | Language | Flag |
|---------|----------|------|
| Japan | Japanese | JP |
| China | Mandarin | CN |
| Thailand | Thai | TH |
| UAE | Arabic | AE |
| South Korea | Korean | KR |
| India | Hindi | IN |
| Vietnam | Vietnamese | VN |
| Indonesia | Indonesian | ID |
| Default | English | -- |

## How It Works

1. **Create a reservation** with hotel details (name, phone, country, dates, guest info)
2. The system **auto-generates a bilingual call script** (Portuguese + hotel's language) using Claude
3. Click **"Ligar Agora"** to initiate an automated call via Telnyx
4. The AI agent **speaks in the hotel's language**, introducing itself and confirming the reservation
5. When the hotel responds, the agent **listens (STT), understands (Claude), and replies (TTS)** in real-time
6. The conversation loop continues until confirmation or natural conclusion
7. Every turn is **saved to Supabase** with text + audio
8. The operator can **review transcripts, listen to recordings, and manage** everything from the Portuguese dashboard

## Project Structure

```
app/
  (dashboard)/          # Auth-protected dashboard
    page.tsx            # Reservation list
    reservations/
      new/page.tsx      # New reservation form
      [id]/page.tsx     # Reservation detail + scripts + calls
    calls/
      [id]/page.tsx     # Call detail + conversation timeline
    admin/
      examples/page.tsx # Manage AI agent few-shot examples
  api/
    reservations/       # CRUD
    scripts/generate/   # Claude script generation + TTS
    tts/generate/       # Standalone TTS endpoint
    calls/initiate/     # Start Telnyx call
    webhooks/telnyx/    # Conversational AI loop
  login/page.tsx        # Auth page
components/
  reservations/         # ReservationForm, ReservationList, StatusBadge
  calls/                # CallPanel, AudioPlayer, ConversationTimeline, TranscriptViewer
  ui/                   # shadcn/ui components
lib/
  supabase/             # Client + Server + Service clients
  telnyx/               # Call control functions
  google/               # TTS + STT wrappers
  claude/               # Script generator + Conversation agent + Few-shot examples
  utils/                # Language config, phone formatter
types/                  # TypeScript interfaces
```
