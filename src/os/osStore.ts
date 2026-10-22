import { createStore } from 'zustand/vanilla';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { appendEvents, createSimulation, step, withPins, type ExternalEvent, type MissionPins, type SimState } from './simulation/engine';
import { addSpecialist, projectLinks, removeAgent, specialistLinks, syncProjectAgents, type ProjectTeam } from './simulation/roster';

/** Intervalo entre pasos de la simulación (ms). */
export const SIMULATION_INTERVAL_MS = 2_500;
const RELATIONS = deriveRelations(CAMPUS_UNITS);

export interface OsState {
  readonly sim: SimState;
  /** Especialistas contratados y activos (los decide `hiringStore`). */
  readonly specialists: readonly string[];
  /** Agentes ocupados por pasos de misión (los decide `missionsStore`). */
  readonly pins: MissionPins;
  /** Equipos de los proyectos activos (F5c): Projektleitung y Bauleitung de cada obra. */
  readonly projects: readonly ProjectTeam[];
  tick(): void;
  syncSpecialists(roleIds: readonly string[]): void;
  syncProjects(teams: readonly ProjectTeam[]): void;
  setPins(pins: MissionPins): void;
  /** Eventos de las misiones para el registro de actividad. */
  record(events: readonly ExternalEvent[]): void;
}

export interface OsStoreOptions {
  readonly seed?: number;
  readonly now?: () => Date;
  /** Pasos simulados «en el pasado» para que el sistema arranque con actividad. */
  readonly warmup?: number;
}

const samePins = (a: MissionPins, b: MissionPins) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** Estado del sistema operativo de agentes (MVP: simulación; B4: Hermes). */
export function createOsStore({ seed = 42, now = () => new Date(), warmup = 0 }: OsStoreOptions = {}) {
  const start = now().getTime() - warmup * SIMULATION_INTERVAL_MS;
  let sim = createSimulation(seed, new Date(start));
  for (let i = 1; i <= warmup; i++) sim = step(sim, new Date(start + i * SIMULATION_INTERVAL_MS), RELATIONS);
  const initial = sim;

  return createStore<OsState>()((set, get) => ({
    sim: initial,
    specialists: [],
    pins: {},
    projects: [],
    tick: () => set({
      sim: step(get().sim, now(), RELATIONS, [...specialistLinks(get().specialists), ...projectLinks(get().projects)], get().pins),
    }),
    syncProjects: (teams) => {
      const synced = syncProjectAgents(get().sim, teams);
      // Mismos equipos: sin estado nuevo (cada página vuelve a sincronizar al montarse).
      if (synced === get().sim && teams.length === get().projects.length) return;
      set({ sim: withPins(synced, get().pins, now()), projects: [...teams] });
    },
    syncSpecialists: (roleIds) => {
      const current = get().specialists;
      const same = current.length === roleIds.length && roleIds.every((id) => current.includes(id));
      if (same) return;
      const removed = current.filter((id) => !roleIds.includes(id)).reduce(removeAgent, get().sim);
      set({ sim: withPins(roleIds.reduce(addSpecialist, removed), get().pins, now()), specialists: [...roleIds] });
    },
    setPins: (pins) => {
      if (samePins(pins, get().pins)) return;
      set({ pins: { ...pins }, sim: withPins(get().sim, pins, now()) });
    },
    record: (events) => {
      if (events.length > 0) set({ sim: appendEvents(get().sim, events) });
    },
  }));
}

export type OsStore = ReturnType<typeof createOsStore>;
