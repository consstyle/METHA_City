import type { PavilionLot } from '@/features/city/model/specialists';
import type { UnitDef } from '@/features/city/model/types';

/**
 * Geometría de un pabellón de especialista (D8, D14): losa, cuerpo, cubierta con canto naranja,
 * baliza y un camino en el suelo hasta la unidad a la que sirve. Función pura (sin three).
 */

export type Vec3 = readonly [number, number, number];

export interface PavilionPart {
  readonly key: 'slab' | 'body' | 'roof' | 'edge' | 'link';
  readonly position: Vec3;
  readonly size: Vec3;
  readonly rotationY: number;
}

export interface PavilionLayout {
  readonly parts: readonly PavilionPart[];
  readonly beacon: Vec3;
  /** Altura del ancla para una etiqueta futura. */
  readonly top: number;
}

const SLAB = 0.22;
const BODY_H = 0.9;
const LINK_GAP = 1.1;

export function pavilionLayout(lot: PavilionLot, unit: UnitDef): PavilionLayout {
  const dx = unit.position.x - lot.x;
  const dz = unit.position.z - lot.z;
  const facing = Math.atan2(dx, dz);
  const distance = Math.hypot(dx, dz);
  const unitReach = Math.max(unit.size.w, unit.size.d) / 2 + 0.5;
  const linkLength = Math.max(0, distance - unitReach - LINK_GAP);
  const ux = dx / distance;
  const uz = dz / distance;
  const linkStart = LINK_GAP;
  const mid = linkStart + linkLength / 2;
  const roofY = SLAB + BODY_H + 0.05;
  // Canto naranja en la fachada que mira a la unidad.
  const front = 0.68;
  return {
    parts: [
      { key: 'slab', position: [lot.x, SLAB / 2 + 0.02, lot.z], size: [2, SLAB, 1.6], rotationY: facing },
      { key: 'body', position: [lot.x, SLAB + BODY_H / 2, lot.z], size: [1.5, BODY_H, 1.1], rotationY: facing },
      { key: 'roof', position: [lot.x, roofY, lot.z], size: [1.7, 0.1, 1.3], rotationY: facing },
      { key: 'edge', position: [lot.x + ux * front, roofY, lot.z + uz * front], size: [1.72, 0.06, 0.05], rotationY: facing },
      { key: 'link', position: [lot.x + ux * mid, 0.09, lot.z + uz * mid], size: [0.12, 0.02, linkLength], rotationY: facing },
    ],
    beacon: [lot.x, roofY + 0.55, lot.z],
    top: roofY + 0.8,
  };
}
