import { z } from 'zod';
import { ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { format, type Messages } from '@/i18n';
import { agentName } from './format';
import type { HiringState } from './hiring';
import type { Mission } from './missions/contract';

/**
 * Diario persistente (D21): lo que no está en la actividad en vivo del motor (misiones,
 * Freigaben, contrataciones). Las entradas salen de comparar el estado antes y después; sus ids
 * son deterministas, así que repetir la comparación (otra pestaña, recarga) no duplica nada.
 */

export const JOURNAL_LIMIT = 200;
export const JOURNAL_KINDS = ['mission', 'approval', 'hiring'] as const;

const isoInstant = z.string().datetime({ offset: true });
export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  at: isoInstant,
  kind: z.enum(JOURNAL_KINDS),
  agentId: z.string().nullable(),
  text: z.string().min(1).max(400),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export const JournalStateSchema = z.object({ entries: z.array(JournalEntrySchema).max(JOURNAL_LIMIT) });

/** Añade las entradas nuevas (sin repetir ids), las más recientes primero. */
export function appendJournal(entries: readonly JournalEntry[], added: readonly JournalEntry[]): JournalEntry[] {
  const known = new Set(entries.map((e) => e.id));
  const fresh = added.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return [...entries];
  return [...fresh, ...entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, JOURNAL_LIMIT);
}

const MISSION_TEXT: Partial<Record<Mission['status'], (j: Messages['journal']) => string>> = {
  'awaiting-plan': (j) => j.planReady,
  'awaiting-result': (j) => j.resultReady,
  cancelled: (j) => j.missionCancelled,
};

export function missionJournal(before: readonly Mission[], after: readonly Mission[], m: Messages): JournalEntry[] {
  const j = m.journal;
  return after.flatMap((mission) => {
    const prev = before.find((x) => x.id === mission.id);
    const vars = { objective: mission.objective };
    const entry = (suffix: string, kind: JournalEntry['kind'], text: string, at: string): JournalEntry =>
      ({ id: `${mission.id}:${suffix}`, at, kind, agentId: ORCHESTRATOR_AGENT, text: format(text, vars) });
    const out: JournalEntry[] = [];
    if (!prev) out.push(entry('created', 'mission', j.missionCreated, mission.createdAt));
    const newDecisions = mission.decisions.slice(prev?.decisions.length ?? 0);
    newDecisions.forEach((d, i) => {
      const n = (prev?.decisions.length ?? 0) + i;
      const text = d.kind === 'plan' ? (d.approve ? j.planApproved : j.planRejected) : d.approve ? j.resultApproved : j.resultRejected;
      out.push(entry(`decision:${n}`, 'approval', text, d.at));
    });
    // Cada paso terminado queda en el diario (la actividad en vivo del motor se olvida pronto).
    for (const step of mission.steps) {
      const was = prev?.steps.find((s) => s.id === step.id);
      if (step.status === 'done' && was?.status !== 'done' && step.finishedAt) {
        out.push({
          id: `${mission.id}:step:${step.id}`, at: step.finishedAt, kind: 'mission', agentId: step.agentId,
          text: format(j.stepDone, { agent: agentName(step.agentId, m), step: step.text }),
        });
      }
    }
    const status = MISSION_TEXT[mission.status];
    if (status && prev?.status !== mission.status) {
      out.push(entry(`${mission.status}:${mission.decisions.length}`, mission.status === 'cancelled' ? 'mission' : 'approval', status(j), mission.updatedAt));
    }
    return out;
  });
}

export function hiringJournal(before: HiringState, after: HiringState, m: Messages): JournalEntry[] {
  const j = m.journal;
  return after.approvals.flatMap((a) => {
    const prev = before.approvals.find((x) => x.id === a.id);
    if (prev?.status === a.status) return [];
    const name = m.specialists[a.roleId].name;
    const text =
      a.status === 'pending' ? (a.kind === 'hire' ? j.hireRequested : j.retireRequested)
        : a.kind === 'hire' ? (a.status === 'approved' ? j.hireApproved : j.hireRejected)
          : a.status === 'approved' ? j.retireApproved : j.retireRejected;
    return [{ id: `${a.id}:${a.status}`, at: a.decidedAt ?? a.requestedAt, kind: 'hiring' as const, agentId: a.roleId, text: format(text, { name }) }];
  });
}
