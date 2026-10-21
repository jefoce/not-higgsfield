import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp', 'ffmpeg-static', '@napi-rs/keyring'],
  outputFileTracingExcludes: {
    '*': ['node_modules/ffmpeg-static/ffmpeg', 'node_modules/ffmpeg-static/ffmpeg.exe'],
  },
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]
    return [
      { source: '/:path*', headers: common },
      { source: '/api/:path*', headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }] },
    ]
  },
}
export default nextConfig
