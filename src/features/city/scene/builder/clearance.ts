import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { curve } from './builder';
import { AVENUES, GREENS, PLAZAS, TREES } from './terrain';

/**
 * Distancia libre (m) de un punto del suelo a lo ya construido: edificios con su pavimento,
 * calles, plazas, jardines, árboles, aparcamientos y el anillo vial.
 * Sirve para comprobar que los solares de los pabellones (D14) no pisan nada.
 */

const ROAD_HALF = 0.7;
const SAMPLES = 160;

const sampled = (points: Parameters<typeof curve>[0]) => curve(points).getSpacedPoints(SAMPLES).map((p) => [p.x, p.z] as const);
const AVENUE_POINTS = AVENUES.map(sampled);
/** Coches aparcados y marcas de aparcamiento (vehicles.ts). */
const PARKING: readonly (readonly [number, number])[] = [
  [-17.4, 6.6], [-13.6, 6.4], [-4.2, -7.1], [-2.7, -7.1], [16.2, 1.5], [16.2, 2.6], [9.8, -4.8], [8.6, -4.8], [16.7, 1.4], [6.9, -3.2],
];

/** Borde interior del anillo vial: misma elipse ondulada que `ellipsePoints(21.2, 13.7)`. */
function insideRing(x: number, z: number, margin: number): boolean {
  const rx = 21.2;
  const rz = 13.7;
  const a = Math.atan2(z / rz, x / rx);
  const f = 1 + 0.095 * Math.sin(3 * a + 0.3) + 0.055 * Math.cos(5 * a) - 0.045 * Math.sin(2 * a);
  return Math.hypot(x, z) + margin < Math.hypot(Math.cos(a) * rx * f, Math.sin(a) * rz * f);
}

const nearest = (x: number, z: number, points: readonly (readonly [number, number])[]) =>
  Math.min(...points.map(([px, pz]) => Math.hypot(x - px, z - pz)));

function boxDistance(x: number, z: number, cx: number, cz: number, hw: number, hd: number): number {
  const dx = Math.max(Math.abs(x - cx) - hw, 0);
  const dz = Math.max(Math.abs(z - cz) - hd, 0);
  return Math.hypot(dx, dz);
}

export function clearance(x: number, z: number): number {
  if (!insideRing(x, z, 0)) return 0;
  const buildings = CAMPUS_UNITS.map((u) => boxDistance(x, z, u.position.x, u.position.z, (u.size.w + 1) / 2, (u.size.d + 1) / 2));
  const avenues = AVENUE_POINTS.map((pts) => nearest(x, z, pts) - ROAD_HALF);
  // Las plazas y el parterre central (tres discos de tierra en terrain.ts).
  const plazas = [...PLAZAS, [3.25, 6.45, 1.6] as const].map(([px, pz, r]) => Math.hypot(x - px, z - pz) - r);
  const greens = GREENS.map(([gx, gz, rx, rz]) => Math.hypot((x - gx) / rx, (z - gz) / rz) * Math.min(rx, rz) - Math.min(rx, rz));
  const ring = insideRing(x, z, 2) ? 2 : insideRing(x, z, 1) ? 1 : 0;
  return Math.max(0, Math.min(
    ...buildings,
    ...avenues,
    ...plazas,
    ...greens,
    nearest(x, z, TREES) - 0.5,
    nearest(x, z, PARKING) - 0.5,
    ring,
  ));
}
