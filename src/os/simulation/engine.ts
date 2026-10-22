import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import type { RelationDef, UnitId } from '@/features/city/model/types';
import type { ActivityEvent, Health, OsSnapshot } from '../contract';

/**
 * Motor de simulación del MVP (decisión D10): agentes guionizados y deterministas que trabajan,
 * delegan según la jerarquía de la ciudad, piden aprobación y terminan. No usa LLM.
 * Núcleo puro: `step` recibe un estado y devuelve otro nuevo.
 */

export const ACTIVITY_LIMIT = 50;
/** Número de textos de tarea por agente en el catálogo (i18n `sim.tasks`). */
export const TASKS_PER_AGENT = 4;

export interface SimAgent {
  readonly id: string;
  readonly kind: 'orchestrator' | 'unit' | 'specialist';
  /** Unidad propia (agente de unidad) o a la que sirve (especialista). */
  readonly unitId: UnitId | null;
  readonly state: 'idle' | 'working' | 'waiting';
  readonly taskIndex: number | null;
  readonly since: number;
  readonly busyFor: number;
  readonly lastActiveAt: string | null;
}

export interface SimState {
  readonly seed: number;
  readonly tick: number;
  readonly now: string;
  readonly agents: readonly SimAgent[];
  readonly activity: readonly ActivityEvent[];
  readonly tasksOpen: number;
  readonly approvalsPending: number;
  readonly missionsRunning: number;
}

/** Hermes aún no está conectado: la salud lo dice tal cual. */
export const SIMULATED_HEALTH: Health = {
  services: [
    { id: 'web', status: 'ok' },
    { id: 'methadesk', status: 'simulated' },
    { id: 'hermes', status: 'offline' },
    { id: 'database', status: 'simulated' },
  ],
};

/** Generador determinista (mulberry32) para cada tick de una semilla. */
function random(seed: number, tick: number): () => number {
  let a = (seed ^ Math.imul(tick + 1, 0x9e3779b1)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Enlace de delegación fuera del modelo de la ciudad (unidad → especialista contratado). */
export interface DelegationLink {
  readonly from: string;
  readonly to: string;
}

/**
 * A quién puede delegar un agente: el orquestador a las cabeceras; una unidad a sus hijas, a su
 * enlace de coordinación y a sus especialistas.
 */
export function delegationTargets(agentId: string, relations: readonly RelationDef[], links: readonly DelegationLink[] = []): string[] {
  if (agentId === ORCHESTRATOR_AGENT) return CAMPUS_UNITS.filter((u) => u.parent === null).map((u) => u.id);
  const city = relations.flatMap((r) => {
    if (r.kind === 'hierarchy') return r.from === agentId ? [r.to] : [];
    if (r.from === agentId) return [r.to];
    return r.to === agentId ? [r.from] : [];
  });
  return [...city, ...links.filter((l) => l.from === agentId).map((l) => l.to)];
}

export function createSimulation(seed: number, now: Date): SimState {
  const defs: Pick<SimAgent, 'id' | 'kind' | 'unitId'>[] = [
    { id: ORCHESTRATOR_AGENT, kind: 'orchestrator', unitId: null },
    ...CAMPUS_UNITS.map((u) => ({ id: u.agent ?? u.id, kind: 'unit' as const, unitId: u.id })),
  ];
  const agents: SimAgent[] = defs.map((a) => ({ ...a, state: 'idle', taskIndex: null, since: 0, busyFor: 0, lastActiveAt: null }));
  return { seed, tick: 0, now: now.toISOString(), agents, activity: [], tasksOpen: 0, approvalsPending: 0, missionsRunning: 0 };
}

export function step(state: SimState, now: Date, relations: readonly RelationDef[], links: readonly DelegationLink[] = []): SimState {
  const tick = state.tick + 1;
  const rnd = random(state.seed, tick);
  const at = now.toISOString();
  const events: ActivityEvent[] = [];
  const emit = (type: ActivityEvent['type'], agentId: string, targetAgentId: string | null, taskIndex: number | null) =>
    events.push({ id: `${state.seed}-${tick}-${events.length}`, tick, at, type, agentId, targetAgentId, taskIndex });

  // 1. Terminan los trabajos y las esperas vencidas
  let agents = state.agents.map((a): SimAgent => {
    if (a.state === 'working' && tick - a.since >= a.busyFor) {
      if (rnd() < 0.25) {
        emit('approval', a.id, null, a.taskIndex);
        return { ...a, state: 'waiting', since: tick, busyFor: 3 + Math.floor(rnd() * 3), lastActiveAt: at };
      }
      emit('completed', a.id, null, a.taskIndex);
      return { ...a, state: 'idle', taskIndex: null, since: tick, lastActiveAt: at };
    }
    if (a.state === 'waiting' && tick - a.since >= a.busyFor) {
      emit('approved', a.id, null, a.taskIndex);
      return { ...a, state: 'idle', taskIndex: null, since: tick, lastActiveAt: at };
    }
    return a;
  });

  const start = (id: string): number => {
    const taskIndex = Math.floor(rnd() * TASKS_PER_AGENT);
    const busyFor = 3 + Math.floor(rnd() * 4);
    agents = agents.map((a) => (a.id === id ? { ...a, state: 'working', taskIndex, since: tick, busyFor, lastActiveAt: at } : a));
    return taskIndex;
  };

  // 2. Un agente libre empieza algo y, a veces, delega en otro libre
  const available = agents.filter((a) => a.state === 'idle' && a.since !== tick);
  if (available.length > 0 && rnd() < 0.7) {
    const chosen = available[Math.floor(rnd() * available.length)] as SimAgent;
    emit('started', chosen.id, null, start(chosen.id));
    const targets = delegationTargets(chosen.id, relations, links).filter((t) =>
      agents.some((a) => a.id === t && a.state === 'idle' && a.since !== tick),
    );
    if (targets.length > 0 && rnd() < 0.6) {
      const target = targets[Math.floor(rnd() * targets.length)] as string;
      const taskIndex = start(target);
      emit('delegated', chosen.id, target, taskIndex);
      emit('started', target, null, taskIndex);
    }
  }

  const waiting = agents.filter((a) => a.state === 'waiting').length;
  const busy = agents.filter((a) => a.state !== 'idle').length;
  const chief = agents.find((a) => a.id === ORCHESTRATOR_AGENT);
  return {
    seed: state.seed,
    tick,
    now: at,
    agents,
    activity: [...state.activity, ...events].slice(-ACTIVITY_LIMIT),
    tasksOpen: busy,
    approvalsPending: waiting,
    missionsRunning: chief && chief.state !== 'idle' ? 1 : 0,
  };
}

/** Delegaciones entre unidades de los últimos `window` ticks (para encender las rutas de la ciudad). */
export function activeDelegations(state: SimState, window = 2): { from: string; to: string | null }[] {
  return state.activity
    .filter((e) => e.type === 'delegated' && e.agentId !== ORCHESTRATOR_AGENT && state.tick - e.tick < window)
    .map((e) => ({ from: e.agentId, to: e.targetAgentId }));
}

export function toSnapshot(state: SimState): OsSnapshot {
  return {
    source: 'simulation',
    generatedAt: state.now,
    agents: state.agents.map(({ id, kind, unitId, state: s, taskIndex, lastActiveAt }) => ({ id, kind, unitId, state: s, taskIndex, lastActiveAt })),
    activity: [...state.activity],
    counts: { tasksOpen: state.tasksOpen, approvalsPending: state.approvalsPending, missionsRunning: state.missionsRunning },
    health: SIMULATED_HEALTH,
  };
}
