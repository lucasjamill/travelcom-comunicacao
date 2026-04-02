export interface LanguageConfig {
  code: string
  name: string
  flag: string
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  // Western languages
  US: { code: 'en', name: 'Inglês (EUA)', flag: '🇺🇸' },
  GB: { code: 'en', name: 'Inglês (UK)', flag: '🇬🇧' },
  ES: { code: 'es', name: 'Espanhol', flag: '🇪🇸' },
  MX: { code: 'es', name: 'Espanhol (México)', flag: '🇲🇽' },
  PT: { code: 'pt', name: 'Português', flag: '🇵🇹' },
  FR: { code: 'fr', name: 'Francês', flag: '🇫🇷' },
  IT: { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  DE: { code: 'de', name: 'Alemão', flag: '🇩🇪' },
  // Asian languages
  JP: { code: 'ja', name: 'Japonês', flag: '🇯🇵' },
  CN: { code: 'zh', name: 'Mandarim', flag: '🇨🇳' },
  TH: { code: 'th', name: 'Tailandês', flag: '🇹🇭' },
  AE: { code: 'ar', name: 'Árabe', flag: '🇦🇪' },
  KR: { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
  IN: { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  VN: { code: 'vi', name: 'Vietnamita', flag: '🇻🇳' },
  ID: { code: 'id', name: 'Indonésio', flag: '🇮🇩' },
  MY: { code: 'ms', name: 'Malaio', flag: '🇲🇾' },
  DEFAULT: { code: 'en', name: 'Inglês', flag: '🌍' },
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
