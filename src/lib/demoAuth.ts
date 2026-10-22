import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Acceso a la demo del MVP en el VPS (F5b, D22): HTTP Basic Auth con un usuario y una contraseña
 * temporales que se definen como variables de entorno en Dokploy. Siempre detrás de HTTPS.
 *
 * - Sin `METHACITY_REQUIRE_AUTH` ni credenciales (desarrollo, e2e): no se pide nada.
 * - La imagen Docker fija `METHACITY_REQUIRE_AUTH=1`: si faltan credenciales válidas, nadie pasa
 *   (falla cerrada) en lugar de quedar abierta por un olvido.
 * - Detrás del proxy (Traefik), una petición por HTTP no se acepta: las credenciales irían en claro.
 *
 * El middleware corre en el runtime de Node, por eso se puede usar `node:crypto`.
 */

export const MIN_PASSWORD_LENGTH = 16;

/** Rutas sin acceso, comparadas exactamente (nada de prefijos: «/api/healthz» no es pública). */
const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/api/health', '/robots.txt']);

export type AccessDecision = 'allow' | 'challenge' | 'misconfigured' | 'insecure';

interface DemoEnv {
  readonly METHACITY_REQUIRE_AUTH?: string;
  readonly DEMO_USER?: string;
  readonly DEMO_PASSWORD?: string;
}

interface DemoRequest {
  readonly authorization: string | null;
  /** `X-Forwarded-Proto` del proxy; null si no hay proxy delante. */
  readonly forwardedProto: string | null;
}

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.has(pathname);

/** Comparación en tiempo constante (sobre resúmenes SHA-256: misma longitud siempre). */
export function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s.normalize('NFC'), 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}

function decodeBasic(authorization: string): { user: string; password: string } | null {
  const match = /^basic ([A-Za-z0-9+/=]+)$/i.exec(authorization.trim());
  if (!match?.[1]) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    return colon < 0 ? null : { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

export function accessDecision({ authorization, forwardedProto }: DemoRequest, env: DemoEnv): AccessDecision {
  const user = env.DEMO_USER ?? '';
  const password = env.DEMO_PASSWORD ?? '';
  const required = env.METHACITY_REQUIRE_AUTH === '1' || user !== '' || password !== '';
  if (!required) return 'allow';
  if (!user || user.includes(':') || password.length < MIN_PASSWORD_LENGTH) return 'misconfigured';
  if (forwardedProto !== null && forwardedProto.split(',')[0]?.trim() !== 'https') return 'insecure';
  const given = authorization ? decodeBasic(authorization) : null;
  if (!given) return 'challenge';
  // Las dos comparaciones siempre se hacen (sin cortocircuito) para no revelar cuál falló.
  const ok = Number(safeEqual(given.user, user)) & Number(safeEqual(given.password, password));
  return ok ? 'allow' : 'challenge';
}
