import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { insideIsland } from '@/features/city/model/island';
import { LANDSCAPE_OBSTACLES, PLAZAS } from '@/features/city/model/landscape';
import { CAMPUS_STREETS, distanceToSegment, distanceToUnit, ROAD_HALF } from '@/features/city/model/streets';

/**
 * Distancia libre (m) de un punto del suelo a lo ya construido: edificios con su pavimento, calles
 * directas, plazas, jardines, árboles y aparcamientos, y el borde de la isla.
 * Sirve para comprobar que los solares de los pabellones (D14) no pisan nada.
 */

/** Margen hasta el borde de la isla. */
const EDGE_MARGIN = 2;

export function clearance(x: number, z: number): number {
  const p = { x, z };
  if (!insideIsland(p)) return 0;
  const edge = insideIsland(p, EDGE_MARGIN) ? EDGE_MARGIN : insideIsland(p, 1) ? 1 : 0;
  return Math.max(0, Math.min(
    ...CAMPUS_UNITS.map((u) => distanceToUnit(p, u)),
    ...CAMPUS_STREETS.map((s) => distanceToSegment(p, s.from, s.to) - ROAD_HALF),
    // La plaza de AVOR no está entre los obstáculos del paisaje (las calles la cruzan), pero tampoco es un solar.
    ...PLAZAS.map(([px, pz, r]) => Math.hypot(x - px, z - pz) - r),
    ...LANDSCAPE_OBSTACLES.map((o) => Math.hypot(x - o.x, z - o.z) - o.r),
    edge,
  ));
}
