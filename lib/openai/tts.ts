import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function synthesizeSpeech(
  text: string,
  _languageCode: string
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    response_format: 'mp3',
    speed: 0.95,
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function synthesizeAndStore(
  text: string,
  languageCode: string,
  prefix: string = 'tts'
): Promise<string> {
  const audioBuffer = await synthesizeSpeech(text, languageCode)
  const supabase = createServiceClient()
  const filename = `${prefix}/${uuidv4()}.mp3`

  const { error } = await supabase.storage
    .from('call-audio')
    .upload(filename, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    })

  if (error) {
    throw new Error(`Erro ao salvar áudio: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('call-audio')
    .getPublicUrl(filename)

  return urlData.publicUrl
}
