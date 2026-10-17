// Plain functions with no React, so server code (schemas used by server actions) can import them.
// Uses the "min" metadata, the same set react-phone-number-input's input uses, so client and server agree.
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/min"

export { isPossiblePhoneNumber } from "libphonenumber-js/min"

// A phone search written the way numbers are stored (international, "+233244123456"), so a local "024 412 3456"
// or a partial "0244" still matches with a contains search. Null when the text doesn't look like a phone number.
export function toPhoneSearch(value: string, country: CountryCode = "GH"): string | null {
  const compact = value.replace(/[\s\-().]/g, "")
  if (!/^\+?\d{3,}$/.test(compact)) return null
  if (compact.startsWith("+")) return compact

  const callingCode = getCountryCallingCode(country)
  if (compact.startsWith("0")) return `+${callingCode}${compact.slice(1)}`
  if (compact.startsWith(callingCode)) return `+${compact}`
  return compact
}
