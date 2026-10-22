import { createStore } from 'zustand/vanilla';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { createSimulation, step, type SimState } from './simulation/engine';

/** Intervalo entre pasos de la simulación (ms). */
export const SIMULATION_INTERVAL_MS = 2_500;
const RELATIONS = deriveRelations(CAMPUS_UNITS);

export interface OsState {
  readonly sim: SimState;
  tick(): void;
}

export interface OsStoreOptions {
  readonly seed?: number;
  readonly now?: () => Date;
  /** Pasos simulados «en el pasado» para que el sistema arranque con actividad. */
  readonly warmup?: number;
}

/** Estado del sistema operativo de agentes (MVP: simulación; B4: Hermes). */
export function createOsStore({ seed = 42, now = () => new Date(), warmup = 0 }: OsStoreOptions = {}) {
  const start = now().getTime() - warmup * SIMULATION_INTERVAL_MS;
  let sim = createSimulation(seed, new Date(start));
  for (let i = 1; i <= warmup; i++) sim = step(sim, new Date(start + i * SIMULATION_INTERVAL_MS), RELATIONS);
  const initial = sim;

  return createStore<OsState>()((set, get) => ({
    sim: initial,
    tick: () => set({ sim: step(get().sim, now(), RELATIONS) }),
  }));
}

export type OsStore = ReturnType<typeof createOsStore>;
