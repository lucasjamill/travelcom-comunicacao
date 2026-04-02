export interface LanguageConfig {
  code: string
  name: string
  flag: string
  ttsLanguage: string
  ttsVoice: string
  sttLanguage: string
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  JP: {
    code: 'ja',
    name: 'Japonês',
    flag: '🇯🇵',
    ttsLanguage: 'ja-JP',
    ttsVoice: 'ja-JP-Neural2-B',
    sttLanguage: 'ja-JP',
  },
  CN: {
    code: 'zh',
    name: 'Mandarim',
    flag: '🇨🇳',
    ttsLanguage: 'cmn-CN',
    ttsVoice: 'cmn-CN-Neural2-B',
    sttLanguage: 'cmn-Hans-CN',
  },
  TH: {
    code: 'th',
    name: 'Tailandês',
    flag: '🇹🇭',
    ttsLanguage: 'th-TH',
    ttsVoice: 'th-TH-Neural2-C',
    sttLanguage: 'th-TH',
  },
  AE: {
    code: 'ar',
    name: 'Árabe',
    flag: '🇦🇪',
    ttsLanguage: 'ar-XA',
    ttsVoice: 'ar-XA-Neural2-B',
    sttLanguage: 'ar',
  },
  KR: {
    code: 'ko',
    name: 'Coreano',
    flag: '🇰🇷',
    ttsLanguage: 'ko-KR',
    ttsVoice: 'ko-KR-Neural2-B',
    sttLanguage: 'ko-KR',
  },
  IN: {
    code: 'hi',
    name: 'Hindi',
    flag: '🇮🇳',
    ttsLanguage: 'hi-IN',
    ttsVoice: 'hi-IN-Neural2-B',
    sttLanguage: 'hi-IN',
  },
  VN: {
    code: 'vi',
    name: 'Vietnamita',
    flag: '🇻🇳',
    ttsLanguage: 'vi-VN',
    ttsVoice: 'vi-VN-Neural2-A',
    sttLanguage: 'vi-VN',
  },
  ID: {
    code: 'id',
    name: 'Indonésio',
    flag: '🇮🇩',
    ttsLanguage: 'id-ID',
    ttsVoice: 'id-ID-Neural2-B',
    sttLanguage: 'id-ID',
  },
  DEFAULT: {
    code: 'en',
    name: 'Inglês',
    flag: '🌍',
    ttsLanguage: 'en-US',
    ttsVoice: 'en-US-Neural2-J',
    sttLanguage: 'en-US',
  },
}

export const COUNTRIES = Object.entries(LANGUAGE_CONFIG)
  .filter(([key]) => key !== 'DEFAULT')
  .map(([key, config]) => ({
    code: key,
    name: config.name,
    flag: config.flag,
    languageCode: config.code,
  }))

export function getLanguageConfig(countryCode: string): LanguageConfig {
  return LANGUAGE_CONFIG[countryCode] || LANGUAGE_CONFIG.DEFAULT
}

export function getLanguageByCode(langCode: string): LanguageConfig {
  const entry = Object.values(LANGUAGE_CONFIG).find((c) => c.code === langCode)
  return entry || LANGUAGE_CONFIG.DEFAULT
}
