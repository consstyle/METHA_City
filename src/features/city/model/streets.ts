import { CAMPUS_UNITS } from './campus';
import { unitById } from './hierarchy';
import type { UnitDef, UnitId } from './types';

/**
 * Calles directas (F5c): todas salen de AVOR, el centro de la ciudad. Cada edificio tiene su
 * calle recta hasta AVOR y cada obra la suya desde AVOR, así un camión de TS siempre recorre una
 * sola calle y se ve de dónde sale y adónde va. Funciones puras, sin three.
 */

export interface Point {
  readonly x: number;
  readonly z: number;
}

export interface Street {
  /** Edificio (o `projekt:<id>`) al que lleva la calle desde AVOR. */
  readonly id: string;
  /** Puerta de AVOR (borde de su pavimento) y puerta del destino. */
  readonly from: Point;
  readonly to: Point;
}

/** Edificio del que salen todas las calles. */
export const HUB: UnitId = 'avor';
/** Media anchura de la calzada (m). */
export const ROAD_HALF = 0.7;
/** El pavimento de cada edificio sobresale 0,5 m (campus.ts dibuja w + 1 × d + 1). */
const PAVING = 0.5;

export const hubUnit = (): UnitDef => {
  const hub = unitById(CAMPUS_UNITS, HUB);
  if (!hub) throw new Error('falta AVOR en el campus');
  return hub;
};

/** Puerta del edificio: borde de su pavimento en dirección al punto dado. */
export function doorToward(unit: Pick<UnitDef, 'position' | 'size'>, toward: Point): Point {
  const { x, z } = unit.position;
  const dx = toward.x - x;
  const dz = toward.z - z;
  const hw = unit.size.w / 2 + PAVING;
  const hd = unit.size.d / 2 + PAVING;
  const k = Math.min(1, hw / Math.abs(dx || 1e-9), hd / Math.abs(dz || 1e-9));
  return { x: x + dx * k, z: z + dz * k };
}

/** Calles de AVOR a cada edificio del campus. */
export const CAMPUS_STREETS: readonly Street[] = (() => {
  const hub = hubUnit();
  return CAMPUS_UNITS.filter((u) => u.id !== HUB).map((u) => ({
    id: u.id,
    from: doorToward(hub, u.position),
    to: doorToward(u, hub.position),
  }));
})();

/** Distancia de un punto a un segmento. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** Distancia de un punto al pavimento de un edificio (0 si cae dentro). */
export function distanceToUnit(p: Point, u: Pick<UnitDef, 'position' | 'size'>): number {
  const dx = Math.max(Math.abs(p.x - u.position.x) - (u.size.w / 2 + PAVING), 0);
  const dz = Math.max(Math.abs(p.z - u.position.z) - (u.size.d / 2 + PAVING), 0);
  return Math.hypot(dx, dz);
}

/** Puntos del segmento cada `step` metros (para medir holguras a lo largo de una calle). */
export function samplesAlong(a: Point, b: Point, step = 0.25): Point[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n }));
}

/** Holgura mínima entre la calle a→b y los edificios (sin contar los de sus extremos). */
export function streetClearance(a: Point, b: Point, ignore: readonly string[]): number {
  const others = CAMPUS_UNITS.filter((u) => !ignore.includes(u.id));
  return Math.min(...samplesAlong(a, b).flatMap((p) => others.map((u) => distanceToUnit(p, u))));
}

/** Ángulo (rad) de la calle vista desde AVOR, para separar las calles que salen de él. */
export const bearing = (s: Pick<Street, 'from' | 'to'>) => Math.atan2(s.to.z - s.from.z, s.to.x - s.from.x);

/** Diferencia angular en [0, π]. */
export const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/** Tramos consecutivos de una calle de varios puntos. */
export const roadSegments = (road: readonly Point[]) => road.slice(1).map((b, i) => [road[i]!, b] as const);
