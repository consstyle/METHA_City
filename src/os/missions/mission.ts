import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { specialistById } from '@/features/city/model/specialists';
import type { Messages } from '@/i18n';
import type { ExternalEvent, MissionPins } from '../simulation/engine';
import type { Mission, MissionContext, MissionInput, MissionStep } from './contract';
import { buildReport } from './report';

/**
 * Ciclo de vida de una misión (F5, D18): planificación → Freigabe del plan → pasos en orden →
 * Freigabe del resultado → informe. Por tiempo real, así sigue donde iba tras recargar.
 * Funciones puras: devuelven una misión nueva y los eventos para el registro de actividad.
 */

export const PLANNING_MS = 3_000;
export const STEP_MS = 5_000;
export const MAX_STEPS = 12;

export interface Transition {
  readonly mission: Mission;
  readonly events: readonly ExternalEvent[];
}

const iso = (ms: number) => new Date(ms).toISOString();
const FINISHED: ReadonlySet<Mission['status']> = new Set(['done', 'rejected', 'cancelled']);

export function createMission(id: string, input: MissionInput, now: Date, steps: readonly MissionStep[], context: MissionContext | null): Mission {
  const at = now.toISOString();
  const [plan, ...rest] = steps;
  if (!plan) throw new Error('a mission needs a plan step');
  return {
    id, objective: input.objective, expected: input.expected, length: input.length, createdAt: at, updatedAt: at,
    status: 'planning', awaitingSince: null, steps: [{ ...plan, status: 'working', startedAt: at }, ...rest],
    decisions: [], report: null, context,
  };
}

/**
 * Quién pasa el trabajo al agente del paso: su unidad superior (así se enciende la ruta de la
 * ciudad entre ambas) o, para las cabeceras, el Chief.
 */
function delegator(agentId: string): string {
  const unit = CAMPUS_UNITS.find((u) => (u.agent ?? u.id) === agentId);
  const parent = unit?.parent ?? specialistById(agentId)?.unitId ?? null;
  return parent ? (CAMPUS_UNITS.find((u) => u.id === parent)?.agent ?? parent) : ORCHESTRATOR_AGENT;
}

/** Evento al empezar un paso: se delega por la jerarquía (o el Chief empieza él mismo). */
const startEvent = (step: MissionStep, at: string): ExternalEvent =>
  step.agentId === ORCHESTRATOR_AGENT
    ? { type: 'started', agentId: step.agentId, targetAgentId: null, note: step.text, at }
    : { type: 'delegated', agentId: delegator(step.agentId), targetAgentId: step.agentId, note: step.text, at };

function startStep(mission: Mission, index: number, at: string): Mission {
  return { ...mission, steps: mission.steps.map((s, i) => (i === index ? { ...s, status: 'working', startedAt: at } : s)) };
}

/** Avanza la misión hasta `now`: completa los pasos vencidos (varios si hace falta). */
export function advance(mission: Mission, now: Date, m: Messages): Transition {
  const events: ExternalEvent[] = [];
  let current = mission;
  let changed = false;
  for (let guard = 0; guard <= current.steps.length; guard++) {
    if (current.status !== 'planning' && current.status !== 'running') break;
    const index = current.steps.findIndex((s) => s.status === 'working');
    const working = current.steps[index];
    if (!working?.startedAt) break;
    // Si el reloj del equipo retrocedió, el paso empieza a contar desde ahora (no se congela).
    if (Date.parse(working.startedAt) > now.getTime()) {
      current = { ...current, steps: current.steps.map((s, i) => (i === index ? { ...s, startedAt: now.toISOString() } : s)) };
      changed = true;
      break;
    }
    const duration = current.status === 'planning' ? PLANNING_MS : STEP_MS;
    const end = Date.parse(working.startedAt) + duration;
    if (now.getTime() < end) break;
    const finishedAt = iso(end);
    current = { ...current, updatedAt: finishedAt, steps: current.steps.map((s, i) => (i === index ? { ...s, status: 'done', finishedAt } : s)) };
    events.push({ type: 'completed', agentId: working.agentId, targetAgentId: null, note: working.text, at: finishedAt });
    if (current.status === 'planning') {
      current = { ...current, status: 'awaiting-plan', awaitingSince: finishedAt };
      break;
    }
    const next = current.steps.findIndex((s) => s.status === 'pending');
    const nextStep = current.steps[next];
    if (!nextStep) {
      const waiting: Mission = { ...current, status: 'awaiting-result', awaitingSince: finishedAt };
      current = { ...waiting, report: buildReport(waiting, m, new Date(end)) };
      break;
    }
    current = startStep(current, next, finishedAt);
    events.push(startEvent(nextStep, finishedAt));
  }
  return { mission: events.length === 0 && !changed ? mission : current, events };
}

function decision(mission: Mission, kind: 'plan' | 'result', approve: boolean, now: Date) {
  return [...mission.decisions, { kind, approve, requestedAt: mission.awaitingSince ?? mission.updatedAt, at: now.toISOString() }].slice(-20);
}

export function decidePlan(mission: Mission, approve: boolean, now: Date): Transition {
  if (mission.status !== 'awaiting-plan') throw new Error(`mission ${mission.id} not awaiting plan approval`);
  const at = now.toISOString();
  const decided: Mission = { ...mission, decisions: decision(mission, 'plan', approve, now), awaitingSince: null, updatedAt: at };
  if (!approve) return { mission: { ...decided, status: 'rejected' }, events: [] };
  const first = decided.steps.findIndex((s) => s.status === 'pending');
  const step = decided.steps[first];
  if (!step) return { mission: { ...decided, status: 'running' }, events: [] };
  return { mission: startStep({ ...decided, status: 'running' }, first, at), events: [startEvent(step, at)] };
}

export function decideResult(mission: Mission, approve: boolean, now: Date, m: Messages): Transition {
  if (mission.status !== 'awaiting-result') throw new Error(`mission ${mission.id} not awaiting result approval`);
  const at = now.toISOString();
  const decided: Mission = { ...mission, decisions: decision(mission, 'result', approve, now), awaitingSince: null, updatedAt: at };
  if (approve) return { mission: { ...decided, status: 'done' }, events: [] };
  if (decided.steps.length >= MAX_STEPS) throw new Error(`mission ${mission.id} has no room for another revision`);
  const revision: MissionStep = {
    id: `s${decided.steps.length}`, kind: 'revision', agentId: ORCHESTRATOR_AGENT, text: m.missions.revisionStep,
    status: 'working', startedAt: at, finishedAt: null,
  };
  return { mission: { ...decided, status: 'running', report: null, steps: [...decided.steps, revision] }, events: [startEvent(revision, at)] };
}

export function cancelMission(mission: Mission, now: Date): Mission {
  if (FINISHED.has(mission.status)) throw new Error(`mission ${mission.id} already finished`);
  // El paso en curso vuelve a «Offen»: ya nadie trabaja en él.
  const steps = mission.steps.map((s): MissionStep => (s.status === 'working' ? { ...s, status: 'pending', startedAt: null } : s));
  return { ...mission, status: 'cancelled', steps, awaitingSince: null, updatedAt: now.toISOString() };
}

/** ¿Cabe otra revisión si se rechaza el resultado? (si no, solo se puede aprobar o cancelar). */
export const canRevise = (mission: Mission) => mission.steps.length < MAX_STEPS;

/** Agentes ocupados ahora mismo por pasos de misión (para la simulación y la ciudad). */
export function pinsOf(missions: readonly Mission[]): MissionPins {
  const pins: Record<string, string> = {};
  for (const mission of missions) {
    if (mission.status !== 'planning' && mission.status !== 'running') continue;
    const working = mission.steps.find((s) => s.status === 'working');
    if (working) pins[working.agentId] = working.text;
  }
  return pins;
}

export const progress = (mission: Mission) => ({ done: mission.steps.filter((s) => s.status === 'done').length, total: mission.steps.length });

export const isFinished = (mission: Mission) => FINISHED.has(mission.status);
