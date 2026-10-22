import type { UnitId } from '@/features/city/model/types';

/**
 * Flujo de Teilsysteme por la ciudad (preview.html «Flujo de Teilsysteme»). Contrato:
 * un evento {nr, from, to, kind} manda un TS de un edificio a otro por las calles.
 * Hoy lo alimenta una simulación del ciclo de MethaDesk; con backend (B1) saldrá de
 * mc.aenderungen (campos «abteilung» y «planStatus») y mc.teilsysteme. Funciones puras.
 */

export const TS_KINDS = ['plan', 'zuteilung', 'bereit', 'fertig'] as const;
export type TsKind = (typeof TS_KINDS)[number];

export const KIND_COLORS: Readonly<Record<TsKind, number>> = {
  plan: 0xf26a21, zuteilung: 0xf7b45d, bereit: 0xe3dac4, fertig: 0x7fc4e0,
};

export interface TsEvent {
  readonly nr: number;
  readonly from: UnitId;
  readonly to: UnitId;
  readonly kind: TsKind;
}

/** Departamentos a los que AVOR reparte los TS. */
export const WORKSHOPS: readonly UnitId[] = ['schlosserei', 'blech', 'einkauf'];

/** Todos los movimientos posibles del ciclo (para comprobar que hay ruta para cada uno). */
export const FLOW_PAIRS: readonly (readonly [UnitId, UnitId])[] = [
  ['projektleitung', 'avor'],
  ...WORKSHOPS.flatMap((w) => [['avor', w] as const, [w, 'avor'] as const]),
  ['avor', 'bau'],
];

export const MAX_ACTIVE = 10;
export const FEED_SIZE = 6;
/** Tras llegar a su destino, un TS descansa este tiempo (reloj simulado) antes de moverse otra vez. */
export const REST_MS = 16_000;
export const MAX_TS = 8;

interface DemoTs {
  readonly nr: number;
  /** 0 plan → 1 zuteilung → 2 bereit → 3 fertig. */
  readonly stage: number;
  readonly dept: UnitId | null;
  /** Libre a partir de este instante del reloj simulado; Infinity mientras su camión circula. */
  readonly until: number;
}

export interface FlowDemo {
  readonly next: number;
  readonly ts: readonly DemoTs[];
}

export const createFlowDemo = (): FlowDemo => ({
  next: 1203,
  ts: [
    { nr: 1198, stage: 1, dept: null, until: 0 },
    { nr: 1199, stage: 2, dept: 'schlosserei', until: 0 },
    { nr: 1200, stage: 3, dept: null, until: 0 },
    { nr: 1201, stage: 2, dept: 'blech', until: 0 },
  ],
});

/**
 * Siguiente movimiento de la simulación (Plan fertig → AVOR → reparto → bereit → AVOR → fertig → obra).
 * `now` es el reloj simulado de la escena (no avanza si no se dibuja). El TS movido queda ocupado
 * hasta que su camión llega (`releaseTs`): así nunca hay dos camiones con el mismo TS.
 */
export function demoTick(demo: FlowDemo, now: number, rnd: () => number): { demo: FlowDemo; event: TsEvent | null } {
  const free = demo.ts.filter((t) => t.until <= now);
  const startNew = demo.ts.length < MAX_TS && (rnd() < 0.4 || free.length === 0);
  const t: DemoTs | undefined = startNew ? { nr: demo.next, stage: 0, dept: null, until: 0 } : free[Math.floor(rnd() * free.length)];
  if (!t) return { demo, event: null };
  const dept = t.stage === 1 ? (WORKSHOPS[Math.floor(rnd() * WORKSHOPS.length)] ?? 'schlosserei') : t.dept ?? 'schlosserei';
  const event: TsEvent =
    t.stage === 0 ? { nr: t.nr, from: 'projektleitung', to: 'avor', kind: 'plan' }
      : t.stage === 1 ? { nr: t.nr, from: 'avor', to: dept, kind: 'zuteilung' }
        : t.stage === 2 ? { nr: t.nr, from: dept, to: 'avor', kind: 'bereit' }
          : { nr: t.nr, from: 'avor', to: 'bau', kind: 'fertig' };
  const moved: DemoTs = { nr: t.nr, stage: t.stage + 1, dept, until: Number.POSITIVE_INFINITY };
  const others = demo.ts.filter((x) => x.nr !== t.nr);
  return {
    demo: { next: startNew ? demo.next + 1 : demo.next, ts: moved.stage > 3 ? others : [...others, moved] },
    event,
  };
}

/** El camión del TS llegó: descansa REST_MS y después puede seguir su ciclo. */
export function releaseTs(demo: FlowDemo, nr: number, now: number): FlowDemo {
  return { ...demo, ts: demo.ts.map((t) => (t.nr === nr && t.until === Number.POSITIVE_INFINITY ? { ...t, until: now + REST_MS } : t)) };
}

/** Si la escena se vuelve a montar, sus camiones ya no existen: los TS que esperaban quedan libres. */
export function releaseAll(demo: FlowDemo, now: number): FlowDemo {
  return { ...demo, ts: demo.ts.map((t) => (t.until === Number.POSITIVE_INFINITY ? { ...t, until: now } : t)) };
}

/** Movimiento del feed con número de orden (clave estable aunque un TS repita tipo). */
export interface FeedEntry extends TsEvent {
  readonly seq: number;
}

/** Feed de los últimos movimientos (el más reciente arriba). */
export const pushFeed = (feed: readonly FeedEntry[], entry: FeedEntry): FeedEntry[] => [entry, ...feed].slice(0, FEED_SIZE);
