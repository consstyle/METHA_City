import { insideIsland, islandExit } from '@/features/city/model/island';
import { ROAD_HALF, roadSegments, type Point } from '@/features/city/model/streets';
import type { SceneBuilder } from './builder';

/**
 * Piezas de las calles directas (F5c): calzada recta con bordillos y línea central, tramo sobre
 * pilares fuera de la isla y farolas. Todo con `b.box`/`b.cylinder` (instanciado).
 */

const PILLAR_STEP = 2.6;
const DASH_STEP = 1.3;
const LAMP_STEP = 3.6;

const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const headingOf = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

/** Calzada de a a b: asfalto, dos bordillos y la línea discontinua del centro. */
export function buildStreet(b: SceneBuilder, from: Point, to: Point): void {
  const { M } = b;
  const l = length(from, to);
  if (l < 0.05) return;
  const ry = headingOf(from, to);
  const mid = lerp(from, to, 0.5);
  b.box(mid.x, 0.075, mid.z, ROAD_HALF * 2, 0.03, l, M.road, ry);
  for (const side of [-1, 1]) {
    const off = side * (ROAD_HALF + 0.05);
    b.box(mid.x + Math.cos(ry) * off, 0.09, mid.z - Math.sin(ry) * off, 0.1, 0.05, l, M.curb, ry);
  }
  for (let d = DASH_STEP / 2; d < l - 0.3; d += DASH_STEP) {
    const p = lerp(from, to, d / l);
    b.box(p.x, 0.093, p.z, 0.045, 0.015, 0.45, M.paint, ry);
  }
}

/** Tablero y pilares bajo el tramo de la calle que queda fuera de la isla. */
export function buildDeck(b: SceneBuilder, from: Point, to: Point): void {
  const { M } = b;
  const start = insideIsland(from) ? Math.max(0, islandExit(from, to) - 0.04) : 0;
  const l = length(from, to);
  const deckLen = (1 - start) * l;
  if (deckLen < 0.1) return;
  const ry = headingOf(from, to);
  const mid = lerp(from, to, start + (1 - start) / 2);
  b.box(mid.x, -0.2, mid.z, ROAD_HALF * 2 + 0.5, 0.5, deckLen, M.edge, ry);
  for (let d = 0.6; d < deckLen - 0.4; d += PILLAR_STEP) {
    const p = lerp(from, to, start + d / l);
    b.box(p.x, -1.05, p.z, 0.32, 1.6, 0.32, M.darkSteel, ry);
  }
}

/** Farolas a un lado de la calle, sin tocar sus extremos (puertas de los edificios); solo donde `free`. */
export function buildLamps(b: SceneBuilder, from: Point, to: Point, free: (p: Point) => boolean = () => true): void {
  const { M } = b;
  const l = length(from, to);
  const ry = headingOf(from, to);
  const off = ROAD_HALF + 0.45;
  for (let d = LAMP_STEP * 0.6; d < l - 1; d += LAMP_STEP) {
    const p = lerp(from, to, d / l);
    const x = p.x + Math.cos(ry) * off;
    const z = p.z - Math.sin(ry) * off;
    if (!free({ x, z })) continue;
    b.cylinder(x, 0.6, z, 0.025, 1.2, M.darkSteel, 6);
    b.box(x, 1.21, z, 0.35, 0.045, 0.14, M.steel, ry);
    b.box(x, 1.18, z, 0.27, 0.02, 0.1, M.warm, ry);
  }
}

/** Parte propia de una calle de obra: entera si es directa; desde el empalme si sigue la de otra. */
const ownPart = (road: readonly Point[]) => (road.length > 2 ? road.slice(1) : road);

/**
 * Tramos de las calles de obra sin repetir: los que salen del mismo punto en la misma dirección
 * (las obras de una fila comparten el principio de su calle) se quedan en el más largo, para no
 * dibujar dos calzadas superpuestas.
 */
export function siteRoadSegments(roads: readonly (readonly Point[])[]): (readonly [Point, Point])[] {
  const longest = new Map<string, readonly [Point, Point]>();
  for (const [from, to] of roads.flatMap((r) => roadSegments(ownPart(r)))) {
    const key = `${from.x.toFixed(2)},${from.z.toFixed(2)}>${headingOf(from, to).toFixed(3)}`;
    const kept = longest.get(key);
    if (!kept || length(kept[0], kept[1]) < length(from, to)) longest.set(key, [from, to]);
  }
  return [...longest.values()];
}

/** Calles de las obras: calzada en cada tramo y tablero sobre pilares donde sale de la isla. */
export function buildSiteRoads(b: SceneBuilder, roads: readonly (readonly Point[])[]): void {
  for (const [from, to] of siteRoadSegments(roads)) {
    buildStreet(b, from, to);
    buildDeck(b, from, to);
  }
}
