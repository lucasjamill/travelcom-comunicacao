import { SpeechClient, protos } from '@google-cloud/speech'
import { getLanguageByCode } from '@/lib/utils/languages'

function getGoogleCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString()
    return JSON.parse(decoded)
  }
  return undefined
}

function createSTTClient() {
  const credentials = getGoogleCredentials()
  if (credentials) {
    return new SpeechClient({ credentials })
  }
  return new SpeechClient()
}

export async function transcribeAudio(
  audioContent: Buffer,
  languageCode: string
): Promise<string> {
  const client = createSTTClient()
  const langConfig = getLanguageByCode(languageCode)

  const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
    audio: {
      content: audioContent.toString('base64'),
    },
    config: {
      encoding: 'MP3' as unknown as protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding,
      sampleRateHertz: 16000,
      languageCode: langConfig.sttLanguage,
      enableAutomaticPunctuation: true,
      model: 'latest_long',
    },
  }

  const [response] = await client.recognize(request)
  const transcription = response.results
    ?.map((result) => result.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(' ')

  return transcription || ''
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
