import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js'

export function formatPhoneNumber(phone: string, country?: string): string {
  const parsed = parsePhoneNumberFromString(phone, country as CountryCode | undefined)
  if (parsed) {
    return parsed.formatInternational()
  }
  return phone
}

export function validatePhoneNumber(phone: string, country?: string): boolean {
  const parsed = parsePhoneNumberFromString(phone, country as CountryCode | undefined)
  return parsed?.isValid() ?? false
}

export function getE164(phone: string, country?: string): string | null {
  const parsed = parsePhoneNumberFromString(phone, country as CountryCode | undefined)
  if (parsed?.isValid()) {
    return parsed.format('E.164')
  }
  return null
}
