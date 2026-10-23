import { CAMPUS_STREETS, HUB, type Point } from '@/features/city/model/streets';
import type { UnitDef } from '@/features/city/model/types';

/**
 * Rutas de los camiones de TS por las calles directas (F5c): todas las calles salen de AVOR, y todos
 * los movimientos del ciclo empiezan o acaban en AVOR, así que cada camión recorre una sola calle
 * (de puerta a puerta) por el carril de la derecha. Sin dependencias del DOM: se prueba en Node.
 */

export type Point2 = readonly [number, number];

export const LANE_OFFSET = 0.36;
/** Desplazamiento máximo de una esquina, en carriles. */
const MITER_MAX = 2;

const toPoint2 = (p: Point): Point2 => [p.x, p.z];

/** Desplaza cada tramo hacia su derecha; las esquinas se resuelven con ingletes (preview.html). */
export function lanePath(points: readonly Point2[], lane: number): Point2[] {
  const normal = (a: Point2, b: Point2): Point2 => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  return points.map((cur, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    let n: Point2;
    if (!prev && next) n = normal(cur, next);
    else if (prev && !next) n = normal(prev, cur);
    else if (prev && next) {
      const a = normal(prev, cur);
      const b = normal(cur, next);
      const k = 1 + a[0] * b[0] + a[1] * b[1];
      n = k < 0.05 ? a : [(a[0] + b[0]) / k, (a[1] + b[1]) / k];
    } else n = [0, 0];
    // En esquinas muy cerradas el inglete se dispara: se limita a MITER_MAX veces el carril.
    const len = Math.hypot(n[0], n[1]);
    const scale = len > MITER_MAX ? MITER_MAX / len : 1;
    return [cur[0] + n[0] * lane * scale, cur[1] + n[1] * lane * scale];
  });
}

/** Ruta de puerta a puerta entre AVOR y un edificio del campus (null si ninguno de los dos es AVOR). */
export function routeBetween(from: Pick<UnitDef, 'id'>, to: Pick<UnitDef, 'id'>): Point2[] | null {
  if (from.id === to.id || (from.id !== HUB && to.id !== HUB)) return null;
  const outbound = from.id === HUB;
  const street = CAMPUS_STREETS.find((s) => s.id === (outbound ? to.id : from.id));
  if (!street) return null;
  const points = outbound ? [street.from, street.to] : [street.to, street.from];
  return lanePath(points.map(toPoint2), LANE_OFFSET);
}

/** Lo que necesita una ruta hacia una obra de proyecto (ver model/projects.ts). */
export interface SiteDestination {
  readonly position: Point;
  /** Calle de la obra: de la puerta de AVOR al borde de su plataforma. */
  readonly road: readonly Point[];
}

/** Dentro de la plataforma, el camión se detiene a esta fracción entre el borde y el centro. */
const SITE_STOP = 0.4;

/** Ruta de AVOR a una obra por su calle, hasta dentro de la plataforma (null si no sale de AVOR). */
export function routeToSite(from: Pick<UnitDef, 'id'>, site: SiteDestination): Point2[] | null {
  const front = site.road.at(-1);
  if (from.id !== HUB || !front) return null;
  const stop = { x: front.x + (site.position.x - front.x) * SITE_STOP, z: front.z + (site.position.z - front.z) * SITE_STOP };
  return lanePath([...site.road, stop].map(toPoint2), LANE_OFFSET);
}
