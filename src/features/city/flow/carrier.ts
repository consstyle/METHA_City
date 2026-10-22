import type { Point2 } from '@/features/city/scene/builder/roads';
import type { TsEvent } from './tsFlow';

/**
 * Movimiento de un camión de TS por su ruta (preview.html `flowStep`): avanza a velocidad
 * constante, gira suavemente hacia cada tramo y, al llegar, se encoge y desaparece.
 * Función pura: devuelve un camión nuevo en cada paso.
 */

export const ARRIVE_SECONDS = 0.7;
const TURN_RATE = 10;

export interface Carrier {
  readonly slot: number;
  readonly event: TsEvent;
  readonly path: readonly Point2[];
  /** Distancia acumulada hasta cada punto de la ruta. */
  readonly cum: readonly number[];
  readonly speed: number;
  readonly d: number;
  readonly seg: number;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly phase: 'drive' | 'arrive' | 'done';
  /** Segundos desde que llegó (encogerse). */
  readonly t: number;
}

const headingOf = (a: Point2, b: Point2) => Math.atan2(b[0] - a[0], b[1] - a[1]);

export function createCarrier(slot: number, event: TsEvent, path: readonly Point2[], speed: number): Carrier {
  if (path.length < 2) throw new Error('a carrier needs a path with at least two points');
  const cum = path.reduce<number[]>((acc, p, i) => {
    const prev = path[i - 1];
    acc.push(i === 0 || !prev ? 0 : acc[i - 1]! + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    return acc;
  }, []);
  const [x, z] = path[0]!;
  return { slot, event, path, cum, speed, d: 0, seg: 0, x, z, heading: headingOf(path[0]!, path[1]!), phase: 'drive', t: 0 };
}

export const routeLength = (c: Carrier) => c.cum.at(-1) ?? 0;

/** Escala del camión: 1 mientras circula; al llegar se encoge hasta desaparecer. */
export const carrierScale = (c: Carrier) => (c.phase === 'drive' ? 1 : Math.max(0, 1 - c.t / ARRIVE_SECONDS));

export function advanceCarrier(c: Carrier, dt: number): Carrier {
  if (c.phase === 'done') return c;
  if (c.phase === 'arrive') {
    const t = c.t + dt;
    return { ...c, t, phase: t >= ARRIVE_SECONDS ? 'done' : 'arrive' };
  }
  const len = routeLength(c);
  const d = Math.min(len, c.d + c.speed * dt);
  let seg = c.seg;
  while (seg < c.path.length - 2 && d > c.cum[seg + 1]!) seg++;
  const a = c.path[seg]!;
  const b = c.path[seg + 1]!;
  const span = c.cum[seg + 1]! - c.cum[seg]! || 1;
  const f = (d - c.cum[seg]!) / span;
  const diff = Math.atan2(Math.sin(headingOf(a, b) - c.heading), Math.cos(headingOf(a, b) - c.heading));
  return {
    ...c,
    d,
    seg,
    x: a[0] + (b[0] - a[0]) * f,
    z: a[1] + (b[1] - a[1]) * f,
    heading: c.heading + diff * Math.min(1, dt * TURN_RATE),
    phase: d >= len ? 'arrive' : 'drive',
    t: 0,
  };
}
