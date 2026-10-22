import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * CSP: Next.js inyecta scripts en línea (por eso 'unsafe-inline' hasta introducir nonces) y en
 * desarrollo necesita 'unsafe-eval' y el WebSocket de recarga en caliente. Las texturas de la
 * escena 3D (F2) se generan como data:/blob:.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Herramienta interna: fuera de los buscadores (D22).
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  // HSTS solo en producción (el navegador lo ignora por HTTP). Si Traefik ya lo pone, se puede quitar.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

const config: NextConfig = {
  // La imagen Docker de la demo (F5b) usa la salida standalone.
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // Las pruebas e2e compilan en otra carpeta para no pisar la de `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
