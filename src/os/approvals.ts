import { specialistById } from '@/features/city/model/specialists';
import { format, type Messages } from '@/i18n';
import { agentName } from './format';
import type { HiringState } from './hiring';
import type { Mission } from './missions/contract';
import { canRevise } from './missions/mission';

/** Vista única de las Freigaben (D19): planes y resultados de misiones, contrataciones y retiradas. */

export type ApprovalSource = 'plan' | 'result' | 'hire' | 'retire';

export interface ApprovalItem {
  readonly id: string;
  readonly source: ApprovalSource;
  readonly title: string;
  readonly detail: string;
  readonly requestedAt: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly decidedAt: string | null;
  readonly missionId: string | null;
  /** Rechazar un resultado añade una revisión; al llegar al límite solo se puede aprobar. */
  readonly canReject: boolean;
}

const byDate = (key: 'requestedAt' | 'decidedAt', dir: 1 | -1) => (a: ApprovalItem, b: ApprovalItem) =>
  dir * String(a[key]).localeCompare(String(b[key]));

function missionItems(mission: Mission, m: Messages): ApprovalItem[] {
  const a = m.approvals;
  const agents = [...new Set(mission.steps.filter((s) => s.kind === 'work').map((s) => agentName(s.agentId, m)))].join(', ');
  const title = (kind: 'plan' | 'result') => format(kind === 'plan' ? a.planTitle : a.resultTitle, { objective: mission.objective });
  const detail = (kind: 'plan' | 'result') => (kind === 'plan' ? format(a.planDetail, { n: mission.steps.length, agents }) : a.resultDetail);
  const history = mission.decisions.map((d, i): ApprovalItem => ({
    id: `${mission.id}:${d.kind}:${i}`, source: d.kind, title: title(d.kind), detail: detail(d.kind),
    requestedAt: d.requestedAt, status: d.approve ? 'approved' : 'rejected', decidedAt: d.at, missionId: mission.id, canReject: false,
  }));
  const kind = mission.status === 'awaiting-plan' ? 'plan' : mission.status === 'awaiting-result' ? 'result' : null;
  if (!kind) return history;
  const pending: ApprovalItem = {
    id: `${mission.id}:${kind}:${mission.decisions.length}`, source: kind, title: title(kind), detail: detail(kind),
    requestedAt: mission.awaitingSince ?? mission.updatedAt, status: 'pending', decidedAt: null, missionId: mission.id,
    canReject: kind === 'plan' || canRevise(mission),
  };
  return [...history, pending];
}

function hiringItems(hiring: HiringState, m: Messages): ApprovalItem[] {
  return hiring.approvals.map((x) => {
    const name = m.specialists[x.roleId].name;
    const unit = agentName(specialistById(x.roleId)?.unitId ?? null, m);
    return {
      id: x.id, source: x.kind, title: format(x.kind === 'hire' ? m.approvals.hireTitle : m.approvals.retireTitle, { name }),
      detail: format(m.approvals.hireDetail, { unit }), requestedAt: x.requestedAt, status: x.status, decidedAt: x.decidedAt, missionId: null,
      canReject: true,
    };
  });
}

export function collectApprovals(hiring: HiringState, missions: readonly Mission[], m: Messages) {
  const all = [...missions.flatMap((x) => missionItems(x, m)), ...hiringItems(hiring, m)];
  return {
    pending: all.filter((x) => x.status === 'pending').sort(byDate('requestedAt', 1)),
    history: all.filter((x) => x.status !== 'pending').sort(byDate('decidedAt', -1)),
  };
}

/** Número de Freigaben pendientes (Leitstand, panel de la ciudad). */
export const pendingCount = (hiring: HiringState, missions: readonly Mission[]) =>
  hiring.approvals.filter((a) => a.status === 'pending').length +
  missions.filter((x) => x.status === 'awaiting-plan' || x.status === 'awaiting-result').length;
