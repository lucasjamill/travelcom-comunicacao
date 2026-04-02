# TravelCom Comunicacao

AI-powered voice agent for international hotel reservation confirmation. The system autonomously calls hotels worldwide, speaks in their local language, confirms booking details in real-time, and records/transcribes the entire conversation.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend:** Next.js API Routes (serverless on Vercel)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **VoIP:** Telnyx Call Control v2
- **TTS:** OpenAI TTS (`tts-1`)
- **STT:** OpenAI Whisper (`whisper-1`)
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
6. Copy your project URL, **publishable key** (`sb_publishable_...`), and **secret key** (`sb_secret_...`) from **Settings > API**

### 3. OpenAI Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Copy it into `OPENAI_API_KEY` in your `.env.local`

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (`sb_secret_...`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TELNYX_API_KEY` | Telnyx API key |
| `TELNYX_CONNECTION_ID` | Telnyx connection/trunk ID |
| `TELNYX_FROM_NUMBER` | Telnyx phone number (E.164) |
| `OPENAI_API_KEY` | OpenAI API key (for TTS + STT) |
| `WEBHOOK_BASE_URL` | Public URL for Telnyx webhooks (see below) |
| `WEBHOOK_SECRET` | Secret for Telnyx webhook signature verification |

### 6. Local Development with ngrok

```bash
npm run dev
```

Telnyx webhooks require a public URL. Use [ngrok](https://ngrok.com) to expose localhost:

```bash
ngrok http 3000
```

Copy the ngrok URL and set it in `.env.local`:

```
WEBHOOK_BASE_URL=https://xxxx-xxxx.ngrok-free.app
```

Also update your Telnyx Call Control app webhook URL to:
```
https://xxxx-xxxx.ngrok-free.app/api/webhooks/telnyx
```

### 7. Deploy to Vercel (Production)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add all environment variables from the table above
4. **Leave `WEBHOOK_BASE_URL` empty** — Vercel's `VERCEL_PROJECT_PRODUCTION_URL` is auto-detected
5. Set `WEBHOOK_SECRET` to your Telnyx webhook signing secret
6. Deploy
7. Update your Telnyx Call Control app webhook URL to:
   ```
   https://your-app.vercel.app/api/webhooks/telnyx
   ```

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
  openai/               # TTS (tts-1) + STT (whisper-1) wrappers
  claude/               # Script generator + Conversation agent + Few-shot examples
  utils/                # Language config, phone formatter
types/                  # TypeScript interfaces
```
