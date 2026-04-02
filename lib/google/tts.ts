import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech'
import { createServiceClient } from '@/lib/supabase/server'
import { getLanguageByCode } from '@/lib/utils/languages'
import { v4 as uuidv4 } from 'uuid'

function getGoogleCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString()
    return JSON.parse(decoded)
  }
  return undefined
}

function createTTSClient() {
  const credentials = getGoogleCredentials()
  if (credentials) {
    return new TextToSpeechClient({ credentials })
  }
  return new TextToSpeechClient()
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<Buffer> {
  const client = createTTSClient()
  const langConfig = getLanguageByCode(languageCode)

  const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    input: { text },
    voice: {
      languageCode: langConfig.ttsLanguage,
      name: langConfig.ttsVoice,
    },
    audioConfig: {
      audioEncoding: 'MP3' as unknown as protos.google.cloud.texttospeech.v1.AudioEncoding,
      speakingRate: 0.95,
      pitch: 0,
    },
  }

  const [response] = await client.synthesizeSpeech(request)
  if (!response.audioContent) {
    throw new Error('Nenhum áudio gerado pelo Google TTS')
  }

  return Buffer.from(response.audioContent as Uint8Array)
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
