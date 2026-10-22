import { CAMPUS_UNITS } from '@/features/city/model/campus';
import type { UnitDef } from '@/features/city/model/types';
import { curve, ellipsePoints } from './builder';
import { AVENUES } from './terrain';

/**
 * Red de calles de la ciudad para el flujo de Teilsysteme (preview.html «Flujo de Teilsysteme»):
 * nodos muestreados sobre las avenidas y el anillo vial, unidos en los cruces. Las rutas van de la
 * puerta de un edificio a la de otro por el camino más corto, en el carril de la derecha.
 * Sin dependencias del DOM: se prueba en Node.
 */

export type Point2 = readonly [number, number];

export const LANE_OFFSET = 0.36;
const AVENUE_SAMPLES = 28;
const RING_SAMPLES = 72;
/** Distancia máxima para unir dos calles en un cruce. */
const JUNCTION = 1.15;
/** Para el extremo de una calle (las avenidas terminan junto al anillo, no siempre encima). */
const JUNCTION_END = 3.2;
/** Margen alrededor de los edificios donde no puede haber un nodo de entrada. */
const BUILDING_MARGIN = 0.6;
/** Desplazamiento máximo de una esquina, en carriles. */
const MITER_MAX = 2;

export interface RoadGraph {
  readonly nodes: readonly Point2[];
  /** Vecinos de cada nodo con la longitud del tramo. */
  readonly adjacency: readonly (readonly (readonly [number, number])[])[];
}

const dist = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function insideAnyBuilding([x, z]: Point2, margin: number): boolean {
  return CAMPUS_UNITS.some((u) => Math.abs(x - u.position.x) < u.size.w / 2 + margin && Math.abs(z - u.position.z) < u.size.d / 2 + margin);
}

let cachedGraph: RoadGraph | null = null;

export function buildRoadGraph(): RoadGraph {
  if (cachedGraph) return cachedGraph;
  const roads: Point2[][] = [
    ...AVENUES.map((points) => curve(points).getSpacedPoints(AVENUE_SAMPLES).map((p) => [p.x, p.z] as const)),
    curve(ellipsePoints(22.3, 14.4, 0)).getSpacedPoints(RING_SAMPLES).slice(0, -1).map((p) => [p.x, p.z] as const),
  ];
  const nodes: Point2[] = [];
  const adjacency: [number, number][][] = [];
  const link = (a: number, b: number) => {
    const l = dist(nodes[a]!, nodes[b]!);
    adjacency[a]!.push([b, l]);
    adjacency[b]!.push([a, l]);
  };
  const roadOf: number[] = [];
  roads.forEach((road, r) => {
    const first = nodes.length;
    road.forEach((p, i) => {
      nodes.push(p);
      adjacency.push([]);
      roadOf.push(r);
      if (i > 0) link(first + i - 1, first + i);
    });
    if (r === roads.length - 1) link(nodes.length - 1, first); // el anillo se cierra
  });
  addJunctions(nodes, adjacency, roadOf, link);
  cachedGraph = { nodes, adjacency };
  return cachedGraph;
}

/** Proyección de p sobre el segmento ab: punto más cercano y su distancia. */
function project(p: Point2, a: Point2, b: Point2): { point: Point2; d: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  const point: Point2 = [a[0] + dx * t, a[1] + dz * t];
  return { point, d: dist(p, point) };
}

/**
 * Cruces: cada nodo cercano a otra calle se une a un nodo nuevo puesto justo en esa calle (sobre
 * su tramo más cercano), unido a los dos extremos del tramo. Así el camión gira en el cruce de
 * verdad, sin pasarse y dar media vuelta.
 */
function addJunctions(nodes: Point2[], adjacency: [number, number][][], roadOf: number[], link: (a: number, b: number) => void) {
  const original = nodes.length;
  const segments: [number, number][] = [];
  for (let a = 0; a < original; a++) for (const [b] of adjacency[a]!) if (a < b && roadOf[a] === roadOf[b]) segments.push([a, b]);
  // Vecinos de cada nodo en su propia calle (antes de añadir cruces).
  const ownNeighbours = adjacency.slice(0, original).map((list, a) => list.map(([n]) => n).filter((n) => roadOf[n] === roadOf[a]));
  for (let a = 0; a < original; a++) {
    // Los extremos de una calle se unen a otra aunque queden algo más lejos (las avenidas acaban junto al anillo).
    const reach = (ownNeighbours[a]?.length ?? 0) <= 1 ? JUNCTION_END : JUNCTION;
    const best = new Map<number, { seg: [number, number]; point: Point2; d: number }>();
    for (const seg of segments) {
      const road = roadOf[seg[0]]!;
      if (road === roadOf[a]) continue;
      const hit = project(nodes[a]!, nodes[seg[0]]!, nodes[seg[1]]!);
      if (hit.d < reach && (!best.has(road) || hit.d < best.get(road)!.d)) best.set(road, { seg, ...hit });
    }
    for (const { seg, point } of best.values()) {
      const id = nodes.length;
      nodes.push(point);
      adjacency.push([]);
      roadOf.push(roadOf[seg[0]]!);
      link(a, id);
      link(id, seg[0]);
      link(id, seg[1]);
      // También desde el nodo anterior de la calle: se gira en el cruce sin llegar al final y volver.
      for (const n of ownNeighbours[a] ?? []) link(n, id);
    }
  }
}

function shortest(graph: RoadGraph, from: number, to: number): number[] | null {
  const best = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const todo = new Set<number>(graph.nodes.map((_, i) => i));
  while (todo.size) {
    let u = -1;
    for (const id of todo) if (best.has(id) && (u < 0 || best.get(id)! < best.get(u)!)) u = id;
    if (u < 0 || u === to) break;
    todo.delete(u);
    for (const [v, l] of graph.adjacency[u] ?? []) {
      const d = best.get(u)! + l;
      if (!best.has(v) || d < best.get(v)!) {
        best.set(v, d);
        prev.set(v, u);
      }
    }
  }
  if (!best.has(to)) return null;
  const out = [to];
  while (out[0] !== from) out.unshift(prev.get(out[0]!)!);
  return out;
}

/** Distancia de un punto al borde del pavimento del edificio (0 si cae dentro). */
function edgeDistance([x, z]: Point2, unit: UnitDef): number {
  const dx = Math.max(Math.abs(x - unit.position.x) - (unit.size.w / 2 + 0.5), 0);
  const dz = Math.max(Math.abs(z - unit.position.z) - (unit.size.d / 2 + 0.5), 0);
  return Math.hypot(dx, dz);
}

/** Nodo de calle donde entra/sale cada edificio: el más cercano a su borde que no esté pegado a otro edificio. */
function gateNode(graph: RoadGraph, unit: UnitDef): number {
  let best = -1;
  graph.nodes.forEach((p, i) => {
    if (insideAnyBuilding(p, BUILDING_MARGIN)) return;
    if (best < 0 || edgeDistance(p, unit) < edgeDistance(graph.nodes[best]!, unit)) best = i;
  });
  return best;
}

/** Puerta del edificio: borde de su pavimento en dirección a su nodo de calle. */
function door(unit: UnitDef, toward: Point2): Point2 {
  const { x, z } = unit.position;
  const dx = toward[0] - x;
  const dz = toward[1] - z;
  const hw = unit.size.w / 2 + 0.5;
  const hd = unit.size.d / 2 + 0.5;
  const k = Math.min(hw / Math.abs(dx || 1e-9), hd / Math.abs(dz || 1e-9));
  return [x + dx * Math.min(k, 1), z + dz * Math.min(k, 1)];
}

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

/** Giro a partir del cual un punto se considera una media vuelta (coseno de 120°). */
const SPIKE_COS = Math.cos((120 * Math.PI) / 180);

/**
 * Quita las medias vueltas: un punto donde la ruta se da la vuelta (pasarse un cruce y volver) se
 * elimina y sus vecinos se unen directamente. Siempre ocurre junto a un cruce, el atajo es mínimo.
 */
export function despike(points: readonly Point2[]): Point2[] {
  const out = [...points];
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      const c = out[i + 1]!;
      const u = [b[0] - a[0], b[1] - a[1]] as const;
      const v = [c[0] - b[0], c[1] - b[1]] as const;
      const lu = Math.hypot(u[0], u[1]);
      const lv = Math.hypot(v[0], v[1]);
      if (lu < 1e-6 || lv < 1e-6 || (u[0] * v[0] + u[1] * v[1]) / (lu * lv) < SPIKE_COS) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}

const routeCache = new Map<string, Point2[] | null>();

/** Ruta de puerta a puerta entre dos edificios (null si no hay o si es el mismo). */
export function routeBetween(from: UnitDef, to: UnitDef): Point2[] | null {
  if (from.id === to.id) return null;
  const key = `${from.id}>${to.id}`;
  if (routeCache.has(key)) return routeCache.get(key)!;
  const graph = buildRoadGraph();
  const a = gateNode(graph, from);
  const b = gateNode(graph, to);
  const ids = a >= 0 && b >= 0 ? shortest(graph, a, b) : null;
  const route = ids
    // Dos pasadas: la ruta en bruto y, después del carril, las esquinas cerradas que el desplazamiento invierte.
    ? despike(lanePath(despike([door(from, graph.nodes[a]!), ...ids.map((i) => graph.nodes[i]!), door(to, graph.nodes[b]!)]), LANE_OFFSET))
    : null;
  routeCache.set(key, route);
  return route;
}
