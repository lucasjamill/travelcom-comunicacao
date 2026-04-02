import OpenAI, { toFile } from 'openai'
import { getLanguageByCode } from '@/lib/utils/languages'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function transcribeAudio(
  audioContent: Buffer,
  languageCode: string
): Promise<string> {
  const langConfig = getLanguageByCode(languageCode)

  const file = await toFile(audioContent, 'audio.mp3', { type: 'audio/mpeg' })

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: langConfig.code,
  })

  return transcription.text || ''
}

export async function transcribeFromUrl(
  audioUrl: string,
  languageCode: string
): Promise<string> {
  const response = await fetch(audioUrl)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return transcribeAudio(buffer, languageCode)
}
