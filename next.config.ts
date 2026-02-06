import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable headers for SharedArrayBuffer (required for FFmpeg multi-threading)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ]
  },

  // Turbopack configuration (Next.js 16+)
  turbopack: {},
}

export default nextConfig
