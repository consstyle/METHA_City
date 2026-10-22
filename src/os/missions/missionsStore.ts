import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import type { Messages } from '@/i18n';
import { createJsonStorage, type KeyValueStore } from '@/lib/storage';
import { uniqueSuffix } from '@/lib/ids';
import type { ExternalEvent } from '../simulation/engine';
import { MissionInputSchema, MissionSchema, type Mission, type MissionContext } from './contract';
import { advance, cancelMission, createMission, decidePlan, decideResult, isFinished } from './mission';
import { planSteps, type PlannerProject } from './planner';

export const MISSION_LIMIT = 20;

/** Una misión dañada se descarta sola (como en el chat). */
const PersistSchema = z.object({
  missions: z.array(z.unknown()).transform((items) => items.flatMap((x) => {
    const parsed = MissionSchema.safeParse(x);
    return parsed.success ? [parsed.data] : [];
  })),
});

export type CreateResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly reason: 'invalid' | 'limit' };

export interface MissionsState {
  readonly missions: readonly Mission[];
  /** Crea la misión (valida la entrada con zod). Con demasiadas misiones abiertas no se crea. */
  /** `projects`: equipos de los proyectos activos (el plan reparte el trabajo de obra entre ellos). */
  create(input: unknown, context: MissionContext | null, activeSpecialists: readonly string[], projects?: readonly PlannerProject[]): CreateResult;
  decide(missionId: string, kind: 'plan' | 'result', approve: boolean): boolean;
  cancel(missionId: string): boolean;
  /** Avanza todas las misiones hasta ahora y devuelve los eventos para la actividad. */
  tick(): readonly ExternalEvent[];
  reload(): void;
}

interface Options {
  readonly m: Messages;
  readonly now?: () => Date;
  readonly getStore?: () => KeyValueStore | null;
  /** Recibe los eventos que producen las decisiones (los de `tick` se devuelven). */
  readonly onEvents?: (events: readonly ExternalEvent[]) => void;
}

/** Por encima del límite solo se descartan misiones terminadas (las más antiguas); nunca las abiertas. */
function capped(missions: readonly Mission[]): Mission[] {
  const excess = missions.length - MISSION_LIMIT;
  if (excess <= 0) return [...missions];
  const finished = missions.filter(isFinished).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const drop = new Set(finished.slice(0, excess).map((x) => x.id));
  return missions.filter((x) => !drop.has(x.id));
}

export function createMissionsStore({ m, now = () => new Date(), getStore, onEvents }: Options) {
  const storage = createJsonStorage('methacity.missions', 1, PersistSchema, getStore);
  return createStore<MissionsState>()((set, get) => {
    /** Lo último guardado (quizá por otra pestaña); cada acción parte de ahí para no pisarla. */
    const latest = () => storage.load()?.missions ?? get().missions;
    const commit = (missions: readonly Mission[]) => {
      const next = capped(missions);
      set({ missions: next });
      storage.save({ missions: next });
    };
    const replace = (id: string, fn: (x: Mission) => { mission: Mission; events: readonly ExternalEvent[] }) => {
      const missions = latest();
      const target = missions.find((x) => x.id === id);
      if (!target) return false;
      try {
        const { mission, events } = fn(target);
        commit(missions.map((x) => (x.id === id ? mission : x)));
        if (events.length > 0) onEvents?.(events);
        return true;
      } catch (error) {
        console.warn('[missions] transición no válida', error);
        return false;
      }
    };
    return {
      missions: storage.load()?.missions ?? [],
      create: (raw, context, activeSpecialists, projects = []) => {
        const input = MissionInputSchema.safeParse(raw);
        if (!input.success) return { ok: false, reason: 'invalid' };
        const missions = latest();
        if (missions.filter((x) => !isFinished(x)).length >= MISSION_LIMIT) return { ok: false, reason: 'limit' };
        const at = now();
        const id = `m-${at.getTime().toString(36)}-${uniqueSuffix()}`;
        const mission = createMission(id, input.data, at, planSteps(input.data.objective, activeSpecialists, m, projects), context);
        commit([mission, ...missions]);
        const plan = mission.steps[0];
        if (plan) onEvents?.([{ type: 'started', agentId: plan.agentId, targetAgentId: null, note: plan.text, at: mission.createdAt }]);
        return { ok: true, id };
      },
      decide: (id, kind, approve) =>
        replace(id, (x) => (kind === 'plan' ? decidePlan(x, approve, now()) : decideResult(x, approve, now(), m))),
      cancel: (id) => replace(id, (x) => ({ mission: cancelMission(x, now()), events: [] })),
      tick: () => {
        const at = now();
        const missions = latest();
        const results = missions.map((x) => advance(x, at, m));
        const events = results.flatMap((r) => r.events);
        // Sin cambios no se toca el estado (los cambios de otra pestaña llegan por el evento storage).
        if (results.some((r, i) => r.mission !== missions[i])) commit(results.map((r) => r.mission));
        return events;
      },
      reload: () => set({ missions: storage.load()?.missions ?? [] }),
    };
  });
}

export type MissionsStore = ReturnType<typeof createMissionsStore>;
