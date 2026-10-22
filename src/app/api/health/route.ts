/** Comprobación de salud para Docker y Dokploy (sin datos ni autenticación). */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
