import { distanceToSegment, ROAD_HALF, roadSegments, type Point } from './streets';

/**
 * Plazas, jardines, árboles y aparcamientos de la isla (preview.html). Viven en el modelo porque
 * las calles de las obras deben esquivarlos (F5c): ningún jardín en medio de una calle.
 */

/** Plazas de las cabeceras: x, z, radio. La de AVOR es el nudo del que salen las calles. */
export const PLAZAS: readonly (readonly [number, number, number])[] = [[-6, -1, 4], [8.5, -8, 3.5]];
/** Índice de la plaza de AVOR (las calles la cruzan; no es obstáculo). */
export const HUB_PLAZA = 0;
/** Zonas ajardinadas: x, z, radio x, radio z. */
export const GREENS: readonly (readonly [number, number, number, number])[] = [
  [-11, -11.7, 2.2, 1.05], [-18, 9.6, 1.7, 1], [18, -6, 1.8, 3], [7.5, 12, 1.6, 1.25], [-1.6, 10, 1.1, 1.6],
];
/** Parterre central: tres discos de tierra (radio 1,6 el mayor) en diagonal; el radio cubre los tres. */
export const FLOWER_BED: readonly [number, number, number] = [3.25, 6.45, 2.15];
export const TREES: readonly (readonly [number, number])[] = [
  [18, -7], [18.2, -5.5], [17.8, -4], [-10, -11.8], [-11.2, -11.5], [-12.3, -12], [-18.5, 9.4], [-17.3, 9.8],
  [7.1, 11.8], [8, 12.4], [-1.8, 9.4], [-1.3, 10.5], [6, -2], [6.5, -0.8], [6.2, 0.3], [-11, 5.7], [-10.6, 6.6], [-8.6, -6.2],
];

export interface ParkedVehicle {
  readonly x: number;
  readonly z: number;
  readonly ry: number;
  readonly truck: boolean;
  readonly orange?: boolean;
}

/** Vehículos aparcados. Los dos camiones del Werkhof esperan a su lado oeste, lejos de las calles. */
export const PARKED: readonly ParkedVehicle[] = [
  { x: -17.4, z: 6.6, ry: -Math.PI / 2, truck: true },
  { x: -13.6, z: 6.4, ry: -Math.PI / 2, truck: false },
  { x: -7.3, z: -9.2, ry: Math.PI / 2, truck: true },
  { x: -7.3, z: -10.7, ry: Math.PI / 2, truck: true },
  { x: 16.2, z: 1.5, ry: 0, truck: false },
  { x: 16.2, z: 2.6, ry: 0, truck: false, orange: true },
  { x: 9.8, z: -4.8, ry: Math.PI / 2, truck: false },
  { x: 8.6, z: -4.8, ry: Math.PI / 2, truck: false },
];

/** Marcas del aparcamiento del este (x fija, z de la primera, separación). */
export const PARKING_LOT = { x: 16.7, z: -0.5, step: 0.77, count: 6 } as const;

/** De qué lista sale un obstáculo (para no dibujar justo lo que una calle de obra pisa). */
export type LandscapeList = 'plaza' | 'green' | 'bed' | 'tree' | 'parked' | 'lot';

/** Obstáculo circular del paisaje: centro y radio (los jardines ovalados, por su radio mayor). */
export interface Obstacle extends Point {
  readonly r: number;
  readonly kind: 'plaza' | 'green' | 'tree' | 'parking';
  readonly list: LandscapeList;
  readonly index: number;
}

/** Margen entre la calzada y un elemento del paisaje. */
export const ROAD_CLEARANCE = 0.25;

/** Todo lo que una calle no debe pisar (salvo la plaza de AVOR, de donde salen las calles). */
export const LANDSCAPE_OBSTACLES: readonly Obstacle[] = [
  ...PLAZAS.flatMap(([x, z, r], index) => (index === HUB_PLAZA ? [] : [{ x, z, r, kind: 'plaza' as const, list: 'plaza' as const, index }])),
  ...GREENS.map(([x, z, rx, rz], index) => ({ x, z, r: Math.max(rx, rz), kind: 'green' as const, list: 'green' as const, index })),
  { x: FLOWER_BED[0], z: FLOWER_BED[1], r: FLOWER_BED[2], kind: 'green', list: 'bed', index: 0 },
  ...TREES.map(([x, z], index) => ({ x, z, r: 0.5, kind: 'tree' as const, list: 'tree' as const, index })),
  ...PARKED.map(({ x, z }, index) => ({ x, z, r: 0.65, kind: 'parking' as const, list: 'parked' as const, index })),
  ...Array.from({ length: PARKING_LOT.count }, (_, index) => ({
    x: PARKING_LOT.x, z: PARKING_LOT.z + index * PARKING_LOT.step, r: 0.45, kind: 'parking' as const, list: 'lot' as const, index,
  })),
];

/** Plantas y coches ceden el sitio a una calle de obra que necesita pasar; las plazas no. */
export const isRemovable = (o: Obstacle) => o.kind !== 'plaza';

/** true si el elemento (centro y radio) queda libre de todas las calles dadas. */
export function clearOfRoads(o: Point & { readonly r: number }, roads: readonly (readonly [Point, Point])[]): boolean {
  return roads.every(([a, b]) => distanceToSegment(o, a, b) >= o.r + ROAD_HALF + ROAD_CLEARANCE);
}

/**
 * Qué elementos del paisaje no se dibujan porque una calle de obra pasa por ellos. Usa los mismos
 * obstáculos (y radios) con los que siteLayout coloca las obras: lo oculto es justo lo que se pisa.
 */
export function hiddenByRoads(roads: readonly (readonly Point[])[]): (list: LandscapeList, index: number) => boolean {
  const segments = roads.flatMap(roadSegments);
  const hidden = new Set(LANDSCAPE_OBSTACLES.filter((o) => isRemovable(o) && !clearOfRoads(o, segments)).map((o) => `${o.list}:${o.index}`));
  return (list, index) => hidden.has(`${list}:${index}`);
}
