import type { SnapshotResult } from '@/data/load';
import type { ReplyData } from '@/os/chat/gateway';
import type { KpiContext } from '@/os/chat/replies';
import type { SimState } from '@/os/simulation/engine';

/** Datos del momento para la respuesta simulada: estado del agente y números de MethaDesk. */
export function replyData(agentId: string, sim: SimState | null, result: SnapshotResult): ReplyData {
  const agent = sim?.agents.find((a) => a.id === agentId);
  const specialists = sim?.agents.filter((a) => a.kind === 'specialist').map((a) => a.id) ?? [];
  return { agent, specialists, kpis: kpisFor(agent?.kind ?? (agentId === 'chief' ? 'orchestrator' : 'unit'), agent?.unitId ?? agentId, result) };
}

function kpisFor(kind: 'orchestrator' | 'unit' | 'specialist', unitId: string, result: SnapshotResult): KpiContext {
  if (kind === 'specialist') return { kind: 'specialist' };
  if (!result.ok) return { kind: 'unavailable' };
  const units = result.snapshot.units;
  if (kind === 'orchestrator') {
    const withData = units.filter((u) => u.hasData);
    return {
      kind: 'all',
      overdue: withData.reduce((s, u) => s + u.alerts.montageUeberfaellig, 0),
      rework: withData.reduce((s, u) => s + u.alerts.nachbearbeitung, 0),
    };
  }
  const u = units.find((x) => x.unitId === unitId);
  if (!u) return { kind: 'unavailable' };
  return { kind: 'unit', hasData: u.hasData, open: u.ts.offen, total: u.ts.total, overdue: u.alerts.montageUeberfaellig, rework: u.alerts.nachbearbeitung };
}
