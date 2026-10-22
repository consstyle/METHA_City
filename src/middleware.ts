import { NextResponse, type NextRequest } from 'next/server';
import { accessDecision, isPublicPath } from '@/lib/demoAuth';

const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' };
let warnedMisconfigured = false;

/**
 * Acceso a la demo (F5b, D22). Corre en el runtime de Node para leer las variables de entorno al
 * arrancar el contenedor (no al compilar la imagen). Pasa por todas las rutas y libra solo las
 * públicas exactas, con la ruta ya normalizada (`nextUrl` resuelve «..» y «%2e»).
 */
export function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const { METHACITY_REQUIRE_AUTH, DEMO_USER, DEMO_PASSWORD } = process.env;
  const decision = accessDecision(
    { authorization: request.headers.get('authorization'), forwardedProto: request.headers.get('x-forwarded-proto') },
    { METHACITY_REQUIRE_AUTH, DEMO_USER, DEMO_PASSWORD },
  );
  if (decision === 'allow') return NextResponse.next();
  if (decision === 'misconfigured') {
    // Una sola vez: no se debe poder llenar el disco de logs con peticiones.
    if (!warnedMisconfigured) console.error('[demo] acceso exigido sin DEMO_USER/DEMO_PASSWORD válidos: se bloquea todo');
    warnedMisconfigured = true;
    return new NextResponse('Die Demo ist nicht konfiguriert.', { status: 503, headers: TEXT });
  }
  if (decision === 'insecure') return new NextResponse('Bitte über HTTPS aufrufen.', { status: 403, headers: TEXT });
  return new NextResponse('Anmeldung erforderlich.', {
    status: 401,
    headers: { ...TEXT, 'WWW-Authenticate': 'Basic realm="METHACity Demo", charset="UTF-8"' },
  });
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/:path*'],
};
