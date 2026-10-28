import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config'

const DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
]

describe('app page CSP', () => {
  it('sets every directive on the document route', async () => {
    const entries = await nextConfig.headers?.()

    const root = entries?.find((entry) => {
      return entry.source === '/'
    })

    const header = root?.headers.find((item) => {
      return item.key === 'Content-Security-Policy'
    })

    expect(header?.value.split('; ')).toEqual(DIRECTIVES)
  })
})
