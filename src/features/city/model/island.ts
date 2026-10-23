/** Contorno ondulado de la isla (preview.html `ellipsePoints`), sin dependencias de three. */

/** Factor de ondulación del borde según el ángulo. */
export function islandWobble(angle: number): number {
  return 1 + 0.095 * Math.sin(3 * angle + 0.3) + 0.055 * Math.cos(5 * angle) - 0.045 * Math.sin(2 * angle);
}

/** Punto del contorno ondulado de una elipse de radios rx/rz en el ángulo dado. */
export function wobblyEllipsePoint(rx: number, rz: number, angle: number): { x: number; z: number } {
  const f = islandWobble(angle);
  return { x: Math.cos(angle) * rx * f, z: Math.sin(angle) * rz * f };
}

/** Radios de la isla (terrain.ts). */
export const ISLAND = { rx: 24.4, rz: 16.3 } as const;

/** true si el punto queda dentro de la isla, al menos a `margin` metros de su borde. */
export function insideIsland(p: { x: number; z: number }, margin = 0): boolean {
  const a = Math.atan2(p.z / ISLAND.rz, p.x / ISLAND.rx);
  const edge = wobblyEllipsePoint(ISLAND.rx, ISLAND.rz, a);
  return Math.hypot(p.x, p.z) + margin < Math.hypot(edge.x, edge.z);
}

/**
 * Punto donde el segmento a→b (a dentro de la isla, b fuera) cruza el borde de la isla, como
 * fracción de su longitud (1 si no lo cruza). Para el tramo sobre pilares de las calles de obra.
 */
export function islandExit(a: { x: number; z: number }, b: { x: number; z: number }, steps = 400): number {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!insideIsland({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return (i - 1) / steps;
  }
  return 1;
}
