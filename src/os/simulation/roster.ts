import { specialistById } from '@/features/city/model/specialists';
import type { DelegationLink, SimAgent, SimState } from './engine';

/** Altas y bajas de especialistas en la simulación (la decisión la toma `hiring.ts`). */

const recount = (state: SimState, agents: readonly SimAgent[]): SimState => ({
  ...state,
  agents,
  tasksOpen: agents.filter((a) => a.state !== 'idle').length,
  approvalsPending: agents.filter((a) => a.state === 'waiting').length,
});

export function addSpecialist(state: SimState, roleId: string): SimState {
  const role = specialistById(roleId);
  if (!role) throw new Error(`unknown specialist ${roleId}`);
  if (state.agents.some((a) => a.id === role.id)) return state;
  const agent: SimAgent = { id: role.id, kind: 'specialist', unitId: role.unitId, state: 'idle', taskIndex: null, focus: null, since: state.tick, busyFor: 0, lastActiveAt: null };
  return recount(state, [...state.agents, agent]);
}

export function removeAgent(state: SimState, id: string): SimState {
  const agent = state.agents.find((a) => a.id === id);
  if (!agent) return state;
  if (agent.kind !== 'specialist') throw new Error(`only specialists can be retired (${id})`);
  return recount(state, state.agents.filter((a) => a.id !== id));
}

/** Enlaces unidad → especialista para la delegación. */
export function specialistLinks(roleIds: readonly string[]): DelegationLink[] {
  return roleIds.flatMap((id) => {
    const role = specialistById(id);
    return role ? [{ from: role.unitId, to: role.id }] : [];
  });
}

/** Equipo de un proyecto activo (F5c, D28). */
export interface ProjectTeam {
  readonly projektId: string;
  readonly agents: { readonly pl: string; readonly bl: string };
}

const projectAgent = (id: string, projectId: string, tick: number): SimAgent => ({
  id, kind: 'project', unitId: null, projectId, state: 'idle', taskIndex: null, focus: null, since: tick, busyFor: 0, lastActiveAt: null,
});

/**
 * Los agentes de proyecto siguen a los proyectos activos: aparecen los nuevos (Projektleitung y
 * Bauleitung) y desaparecen los archivados. Sin cambios devuelve el mismo estado.
 */
export function syncProjectAgents(state: SimState, teams: readonly ProjectTeam[]): SimState {
  const wanted = teams.flatMap((t) => [[t.agents.pl, t.projektId], [t.agents.bl, t.projektId]] as const);
  const current = state.agents.filter((a) => a.kind === 'project');
  const same = current.length === wanted.length && wanted.every(([id, projectId], i) => current[i]?.id === id && current[i]?.projectId === projectId);
  if (same) return state;
  const kept = state.agents.filter((a) => a.kind !== 'project');
  const existing = new Map(current.map((a) => [a.id, a]));
  // Un agente que ya existía conserva su estado; si su proyecto cambió de id, se actualiza.
  const project = wanted.map(([id, projectId]) => {
    const old = existing.get(id);
    if (!old) return projectAgent(id, projectId, state.tick);
    return old.projectId === projectId ? old : { ...old, projectId };
  });
  return recount(state, [...kept, ...project]);
}

/** Chief → cada Projektleitung, Projektleitung → su Bauleitung y AVOR ↔ cada Bauleitung (coordinación). */
export function projectLinks(teams: readonly ProjectTeam[]): DelegationLink[] {
  return teams.flatMap(({ agents: { pl, bl } }) => [
    { from: 'chief', to: pl },
    { from: pl, to: bl },
    { from: 'avor', to: bl },
    { from: bl, to: 'avor' },
  ]);
}
