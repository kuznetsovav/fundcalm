/** ISO 3166-1 alpha-2 codes we support in onboarding & currency display. */

export const COUNTRY_OPTIONS: {
  code: string;
  label: string;
  currency: string;
  locale: string;
  region: string;
}[] = [
  { code: "US", label: "United States", currency: "USD", locale: "en-US", region: "Americas" },
  { code: "CA", label: "Canada", currency: "CAD", locale: "en-CA", region: "Americas" },
  { code: "MX", label: "Mexico", currency: "MXN", locale: "es-MX", region: "Americas" },
  { code: "BR", label: "Brazil", currency: "BRL", locale: "pt-BR", region: "Americas" },
  { code: "AR", label: "Argentina", currency: "ARS", locale: "es-AR", region: "Americas" },
  { code: "CL", label: "Chile", currency: "CLP", locale: "es-CL", region: "Americas" },
  { code: "CO", label: "Colombia", currency: "COP", locale: "es-CO", region: "Americas" },
  { code: "GB", label: "United Kingdom", currency: "GBP", locale: "en-GB", region: "Europe" },
  { code: "IE", label: "Ireland", currency: "EUR", locale: "en-IE", region: "Europe" },
  { code: "DE", label: "Germany", currency: "EUR", locale: "de-DE", region: "Europe" },
  { code: "FR", label: "France", currency: "EUR", locale: "fr-FR", region: "Europe" },
  { code: "ES", label: "Spain", currency: "EUR", locale: "es-ES", region: "Europe" },
  { code: "IT", label: "Italy", currency: "EUR", locale: "it-IT", region: "Europe" },
  { code: "NL", label: "Netherlands", currency: "EUR", locale: "nl-NL", region: "Europe" },
  { code: "BE", label: "Belgium", currency: "EUR", locale: "nl-BE", region: "Europe" },
  { code: "AT", label: "Austria", currency: "EUR", locale: "de-AT", region: "Europe" },
  { code: "CH", label: "Switzerland", currency: "CHF", locale: "de-CH", region: "Europe" },
  { code: "PT", label: "Portugal", currency: "EUR", locale: "pt-PT", region: "Europe" },
  { code: "PL", label: "Poland", currency: "PLN", locale: "pl-PL", region: "Europe" },
  { code: "SE", label: "Sweden", currency: "SEK", locale: "sv-SE", region: "Europe" },
  { code: "NO", label: "Norway", currency: "NOK", locale: "nb-NO", region: "Europe" },
  { code: "DK", label: "Denmark", currency: "DKK", locale: "da-DK", region: "Europe" },
  { code: "FI", label: "Finland", currency: "EUR", locale: "fi-FI", region: "Europe" },
  { code: "GR", label: "Greece", currency: "EUR", locale: "el-GR", region: "Europe" },
  { code: "CZ", label: "Czech Republic", currency: "CZK", locale: "cs-CZ", region: "Europe" },
  { code: "RO", label: "Romania", currency: "RON", locale: "ro-RO", region: "Europe" },
  { code: "UA", label: "Ukraine", currency: "UAH", locale: "uk-UA", region: "Europe" },
  { code: "TR", label: "Turkey", currency: "TRY", locale: "tr-TR", region: "Europe" },
  { code: "RU", label: "Russia", currency: "RUB", locale: "ru-RU", region: "Europe" },
  { code: "IN", label: "India", currency: "INR", locale: "en-IN", region: "Asia" },
  { code: "CN", label: "China", currency: "CNY", locale: "zh-CN", region: "Asia" },
  { code: "JP", label: "Japan", currency: "JPY", locale: "ja-JP", region: "Asia" },
  { code: "KR", label: "South Korea", currency: "KRW", locale: "ko-KR", region: "Asia" },
  { code: "SG", label: "Singapore", currency: "SGD", locale: "en-SG", region: "Asia" },
  { code: "AU", label: "Australia", currency: "AUD", locale: "en-AU", region: "Asia" },
  { code: "NZ", label: "New Zealand", currency: "NZD", locale: "en-NZ", region: "Asia" },
  { code: "TH", label: "Thailand", currency: "THB", locale: "th-TH", region: "Asia" },
  { code: "VN", label: "Vietnam", currency: "VND", locale: "vi-VN", region: "Asia" },
  { code: "PH", label: "Philippines", currency: "PHP", locale: "en-PH", region: "Asia" },
  { code: "ID", label: "Indonesia", currency: "IDR", locale: "id-ID", region: "Asia" },
  { code: "MY", label: "Malaysia", currency: "MYR", locale: "ms-MY", region: "Asia" },
  { code: "AE", label: "United Arab Emirates", currency: "AED", locale: "ar-AE", region: "Asia" },
  { code: "SA", label: "Saudi Arabia", currency: "SAR", locale: "ar-SA", region: "Asia" },
  { code: "IL", label: "Israel", currency: "ILS", locale: "he-IL", region: "Asia" },
  { code: "ZA", label: "South Africa", currency: "ZAR", locale: "en-ZA", region: "Africa" },
  { code: "NG", label: "Nigeria", currency: "NGN", locale: "en-NG", region: "Africa" },
  { code: "EG", label: "Egypt", currency: "EGP", locale: "ar-EG", region: "Africa" },
  { code: "KE", label: "Kenya", currency: "KES", locale: "en-KE", region: "Africa" },
  {
    code: "EU_OTHER",
    label: "Europe (other)",
    currency: "EUR",
    locale: "en-GB",
    region: "Europe",
  },
  { code: "OTHER", label: "Other / not listed", currency: "USD", locale: "en-US", region: "Other" },
];

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]["code"];

const BY_CODE = new Map(COUNTRY_OPTIONS.map((c) => [c.code, c] as const));

export function countryMeta(code: string) {
  return BY_CODE.get(code) ?? BY_CODE.get("OTHER")!;
}

export function countryLabel(code: string): string {
  return countryMeta(code).label;
}

export const VALID_COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map((c) => c.code));
