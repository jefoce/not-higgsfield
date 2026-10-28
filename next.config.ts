import type { NextConfig } from 'next'

import packageJson from './package.json'

/**
 * CSP for the app page. Next bootstrap styles and the OS_SCRIPT inline script
 * need 'unsafe-inline'. Tauri 2 IPC needs `ipc:` and `http://ipc.localhost`,
 * which Tauri cannot add itself because it owns no CSP in tauri.conf.json.
 */
const APP_CSP = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ['sharp', '@napi-rs/keyring'],
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]
    return [
      { source: '/:path*', headers: common },
      {
        source: '/',
        headers: [{ key: 'Content-Security-Policy', value: APP_CSP }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
      },
    ]
  },
}
export default nextConfig
