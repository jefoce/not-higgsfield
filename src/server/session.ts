import 'server-only'

import { timingSafeEqual } from 'node:crypto'

const TOKEN = process.env.APP_TOKEN?.trim() || null
export const SESSION_COOKIE = 'nh_session'

/** Desktop sets APP_TOKEN. Browser mode has no session check. */
export function sessionRequired(): boolean {
  return TOKEN !== null
}

export function tokenMatches(value: string | null | undefined): boolean {
  if (!TOKEN || !value) return false
  const a = Buffer.from(value)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Reads the session cookie. Missing or wrong values fail closed. */
export function hasSession(request: Request): boolean {
  if (!TOKEN) return true
  const cookie = request.headers.get('cookie') ?? ''
  const value = cookie
    .split(/;\s*/)
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  return tokenMatches(value)
}
