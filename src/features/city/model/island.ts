/** Contorno ondulado de la isla y de sus anillos (preview.html `ellipsePoints`), sin dependencias de three. */

/** Factor de ondulación del borde según el ángulo. */
export function islandWobble(angle: number): number {
  return 1 + 0.095 * Math.sin(3 * angle + 0.3) + 0.055 * Math.cos(5 * angle) - 0.045 * Math.sin(2 * angle);
}

/** Punto del contorno ondulado de una elipse de radios rx/rz en el ángulo dado. */
export function wobblyEllipsePoint(rx: number, rz: number, angle: number): { x: number; z: number } {
  const f = islandWobble(angle);
  return { x: Math.cos(angle) * rx * f, z: Math.sin(angle) * rz * f };
}

/** Radios de la isla y del anillo vial (terrain.ts). */
export const ISLAND = { rx: 24.4, rz: 16.3 } as const;
export const RING_ROAD = { rx: 22.3, rz: 14.4 } as const;
