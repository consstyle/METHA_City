import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { projectSiteId } from '@/features/city/model/projects';
import { PAVILION_LOTS } from '@/features/city/model/specialists';
import type { DistrictId } from '@/features/city/model/types';
import type { HiringState } from '@/os/hiring';
import type { SimAgent } from '@/os/simulation/engine';

/** Lógica pura del directorio de agentes (filtros, distrito y solares libres). */

export const AGENT_FILTERS = ['all', 'units', 'specialists'] as const;
export type AgentFilter = (typeof AGENT_FILTERS)[number];

const KIND_ORDER: Record<SimAgent['kind'], number> = { orchestrator: 0, unit: 1, project: 2, specialist: 3 };

/** «Einheiten» incluye el Chief, los edificios del campus y los equipos de proyecto. */
export function filterAgents(agents: readonly SimAgent[], filter: AgentFilter): SimAgent[] {
  const keep = (a: SimAgent) =>
    filter === 'all' || (filter === 'units' ? a.kind !== 'specialist' : a.kind === 'specialist');
  return agents.filter(keep).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** Distrito del agente: el de su edificio, o «Baustellen» para los equipos de proyecto (F5c). */
export function districtOf(agent: Pick<SimAgent, 'unitId'> & Partial<Pick<SimAgent, 'kind'>>): DistrictId | null {
  if (agent.kind === 'project') return 'project';
  return CAMPUS_UNITS.find((u) => u.id === agent.unitId)?.district ?? null;
}

/** Dónde se ve el agente en la ciudad: su edificio o la obra de su proyecto (null si no tiene sitio). */
export function cityPlaceOf(agent: Pick<SimAgent, 'unitId' | 'kind' | 'projectId'>): string | null {
  if (agent.unitId) return agent.unitId;
  return agent.kind === 'project' && agent.projectId ? projectSiteId(agent.projectId) : null;
}

export function freeLots(hiring: HiringState): Record<DistrictId, number> {
  const taken = new Set(hiring.hires.map((h) => h.lotId));
  const free = (d: DistrictId) => PAVILION_LOTS.filter((l) => l.district === d && !taken.has(l.id)).length;
  return { industrial: free('industrial'), project: free('project') };
}

/** Estado de un papel del catálogo para la interfaz. */
export type CatalogStatus = 'available' | 'no-lot' | 'pending-hire' | 'active' | 'pending-retire';

export function catalogStatus(hiring: HiringState, roleId: string, district: DistrictId): CatalogStatus {
  const hire = hiring.hires.find((h) => h.roleId === roleId);
  const pending = hiring.approvals.find((a) => a.roleId === roleId && a.status === 'pending');
  if (hire?.status === 'pending') return 'pending-hire';
  if (hire) return pending ? 'pending-retire' : 'active';
  return freeLots(hiring)[district] > 0 ? 'available' : 'no-lot';
}
