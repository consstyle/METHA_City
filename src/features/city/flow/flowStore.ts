import { createStore } from 'zustand/vanilla';
import { createFlowDemo, demoTick, pushFeed, releaseAll, releaseTs, type FeedEntry, type FlowDemo, type TsEvent } from './tsFlow';

/**
 * Estado del flujo de Teilsysteme que debe sobrevivir a cambiar de módulo: la simulación, su reloj
 * y el feed del panel. La escena (TsFlow) solo guarda los camiones que están en la calle.
 * El reloj es simulado: avanza con los fotogramas dibujados (`elapsedMs`), no con el reloj real.
 */
export interface FlowState {
  readonly feed: readonly FeedEntry[];
  readonly demo: FlowDemo;
  /** Reloj simulado (ms). */
  readonly clock: number;
  readonly seq: number;
  /** Ya se aplicó el valor por defecto de «menos movimiento» (solo una vez por visita). */
  readonly motionDefaultApplied: boolean;
  /** Propone el siguiente movimiento (el TS queda ocupado hasta `arrived`). */
  next(elapsedMs: number, rnd: () => number): TsEvent | null;
  /** El camión del TS llegó a su destino. */
  arrived(nr: number, elapsedMs: number): void;
  /** Movimiento que sí salió a la calle: entra en el feed. */
  record(event: TsEvent): void;
  /** La escena se montó de nuevo: los camiones anteriores ya no existen. */
  remount(): void;
  markMotionDefault(): void;
}

export const createFlowStore = () =>
  createStore<FlowState>()((set, get) => ({
    feed: [],
    demo: createFlowDemo(),
    clock: 0,
    seq: 0,
    motionDefaultApplied: false,
    next: (elapsedMs, rnd) => {
      const clock = get().clock + elapsedMs;
      const { demo, event } = demoTick(get().demo, clock, rnd);
      set({ clock, demo });
      return event;
    },
    arrived: (nr, elapsedMs) => {
      const clock = get().clock + elapsedMs;
      set({ clock, demo: releaseTs(get().demo, nr, clock) });
    },
    record: (event) => set({ feed: pushFeed(get().feed, { ...event, seq: get().seq }), seq: get().seq + 1 }),
    remount: () => set({ demo: releaseAll(get().demo, get().clock) }),
    markMotionDefault: () => set({ motionDefaultApplied: true }),
  }));

export type FlowStore = ReturnType<typeof createFlowStore>;

/** Etiquetas «TS 1203» sobre los camiones: elementos del DOM que la escena coloca en cada fotograma. */
export interface FlowTagRegistry {
  readonly tags: (HTMLElement | null)[];
}
