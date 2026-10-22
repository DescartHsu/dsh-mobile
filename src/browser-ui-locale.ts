import { resolveAuthPageLocale, type AuthPageLocale } from './auth-pages.js'

const UI_LOCALE_COOKIE = 'dsh_ma_ui_locale'

/** Read presentation data only; malformed or ambiguous cookies keep browser negotiation. */
export function readBrowserUiLocale(cookieHeader: string | undefined): AuthPageLocale | undefined {
  if (cookieHeader === undefined || cookieHeader.length > 8192) return undefined
  const values = cookieHeader.split(';').filter(part => part.slice(0, part.indexOf('=')).trim() === UI_LOCALE_COOKIE)
  if (values.length !== 1) return undefined
  const value = values[0]!.slice(values[0]!.indexOf('=') + 1).trim()
  return value === 'en' || value === 'zh' || value === 'it' ? value : undefined
}

/** Prefer the last DSH display language over the browser's default language. */
export function resolveBrowserUiLocale(cookieHeader: string | undefined, acceptLanguage: string | undefined): AuthPageLocale {
  return readBrowserUiLocale(cookieHeader) ?? resolveAuthPageLocale(acceptLanguage)
}

/** Host-only, non-secret preference, independent of the short authentication session. */
export function browserUiLocaleCookie(locale: AuthPageLocale, secure: boolean): string {
  return `${UI_LOCALE_COOKIE}=${locale}; Path=/mobile-access; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`
}
