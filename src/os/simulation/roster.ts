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
