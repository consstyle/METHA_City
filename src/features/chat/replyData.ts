import type { SnapshotResult } from '@/data/load';
import type { ReplyData } from '@/os/chat/gateway';
import type { KpiContext } from '@/os/chat/replies';
import type { SimAgent, SimState } from '@/os/simulation/engine';
import type { ProjectTeam } from '@/os/simulation/roster';

/** Datos del momento para la respuesta simulada: estado del agente y números de MethaDesk. */
export function replyData(agentId: string, sim: SimState | null, result: SnapshotResult): ReplyData {
  const agent = sim?.agents.find((a) => a.id === agentId);
  const specialists = sim?.agents.filter((a) => a.kind === 'specialist').map((a) => a.id) ?? [];
  const kind = agent?.kind ?? (agentId === 'chief' ? 'orchestrator' : 'unit');
  return { agent, specialists, teams: teamsOf(sim), kpis: kpisFor(kind, agent, agentId, result) };
}

/** Equipos de proyecto a partir de los agentes de la simulación (Projektleitung y Bauleitung por proyecto). */
export function teamsOf(sim: SimState | null): ProjectTeam[] {
  const byProject = new Map<string, { pl?: string; bl?: string }>();
  for (const a of sim?.agents ?? []) {
    if (a.kind !== 'project' || !a.projectId) continue;
    const team = byProject.get(a.projectId) ?? {};
    byProject.set(a.projectId, a.id.startsWith('pl-') ? { ...team, pl: a.id } : { ...team, bl: a.id });
  }
  return [...byProject].flatMap(([projektId, { pl, bl }]) => (pl && bl ? [{ projektId, agents: { pl, bl } }] : []));
}

function kpisFor(kind: SimAgent['kind'], agent: SimAgent | undefined, agentId: string, result: SnapshotResult): KpiContext {
  if (kind === 'specialist') return { kind: 'specialist' };
  if (!result.ok) return { kind: 'unavailable' };
  if (kind === 'project') {
    // Equipo de proyecto (F5c): los números de su proyecto en mc.projekt_kennzahlen.
    const p = result.snapshot.projects.find((x) => x.projektId === agent?.projectId);
    if (!p) return { kind: 'unavailable' };
    return { kind: 'project', projekt: p.projektnummer, total: p.tsTotal, verbaut: p.tsVerbaut, overdue: p.montageUeberfaellig, rework: p.nachbearbeitung };
  }
  const units = result.snapshot.units;
  if (kind === 'orchestrator') {
    // El Chief ve el campus y las obras de los proyectos.
    const withData = units.filter((u) => u.hasData);
    const { projects } = result.snapshot;
    return {
      kind: 'all',
      overdue: withData.reduce((s, u) => s + u.alerts.montageUeberfaellig, 0) + projects.reduce((s, p) => s + p.montageUeberfaellig, 0),
      rework: withData.reduce((s, u) => s + u.alerts.nachbearbeitung, 0) + projects.reduce((s, p) => s + p.nachbearbeitung, 0),
    };
  }
  const u = units.find((x) => x.unitId === (agent?.unitId ?? agentId));
  if (!u) return { kind: 'unavailable' };
  return { kind: 'unit', hasData: u.hasData, open: u.ts.offen, total: u.ts.total, overdue: u.alerts.montageUeberfaellig, rework: u.alerts.nachbearbeitung };
}
