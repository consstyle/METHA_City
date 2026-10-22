import { z } from 'zod';
import { PAVILION_LOTS, SPECIALIST_IDS, specialistById } from '@/features/city/model/specialists';
import type { DistrictId } from '@/features/city/model/types';

/**
 * Contratar y retirar especialistas (D8, D13). Toda alta o baja pasa por una Freigabe que
 * decide una persona; mientras tanto el solar queda reservado. Funciones puras e inmutables.
 */

const isoInstant = z.string().datetime({ offset: true });
const RoleIdSchema = z.enum(SPECIALIST_IDS);

export const HireSchema = z.object({
  roleId: RoleIdSchema,
  lotId: z.string().min(1),
  status: z.enum(['pending', 'active']),
  requestedAt: isoInstant,
});
export type Hire = z.infer<typeof HireSchema>;

export const ApprovalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['hire', 'retire']),
  roleId: RoleIdSchema,
  status: z.enum(['pending', 'approved', 'rejected']),
  requestedAt: isoInstant,
  decidedAt: isoInstant.nullable(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

/** Freigaben ya decididas que se conservan como historial. */
export const DECIDED_HISTORY = 50;

const unique = (values: readonly string[]) => new Set(values).size === values.length;

/** Además de la forma, comprueba las reglas del dominio: lo guardado puede estar viejo o tocado. */
export const HiringStateSchema = z
  .object({ hires: z.array(HireSchema), approvals: z.array(ApprovalSchema) })
  .superRefine(({ hires, approvals }, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (!unique(hires.map((h) => h.roleId)) || !unique(hires.map((h) => h.lotId))) issue('duplicate role or lot');
    if (!unique(approvals.map((a) => a.id))) issue('duplicate approval id');
    for (const h of hires) {
      const lot = PAVILION_LOTS.find((l) => l.id === h.lotId);
      if (!lot || lot.district !== specialistById(h.roleId)?.district) issue(`invalid lot ${h.lotId} for ${h.roleId}`);
    }
    for (const a of approvals.filter((x) => x.status === 'pending')) {
      const hire = hires.find((h) => h.roleId === a.roleId);
      const expected = a.kind === 'hire' ? 'pending' : 'active';
      if (hire?.status !== expected) issue(`pending ${a.kind} without ${expected} hire (${a.roleId})`);
    }
  });
export type HiringState = z.infer<typeof HiringStateSchema>;

export const EMPTY_HIRING: HiringState = { hires: [], approvals: [] };

export type HireCheck = 'ok' | 'already' | 'no-lot' | 'unknown';

export function freeLot(state: HiringState, district: DistrictId): string | null {
  const taken = new Set(state.hires.map((h) => h.lotId));
  return PAVILION_LOTS.find((l) => l.district === district && !taken.has(l.id))?.id ?? null;
}

export function canHire(state: HiringState, roleId: string): HireCheck {
  const role = specialistById(roleId);
  if (!role) return 'unknown';
  if (state.hires.some((h) => h.roleId === roleId)) return 'already';
  return freeLot(state, role.district) ? 'ok' : 'no-lot';
}

/** Id único aunque se recorte el historial: papel, tipo e instante (no hay dos solicitudes iguales a la vez). */
const approval = (state: HiringState, kind: Approval['kind'], roleId: Hire['roleId'], now: Date): Approval => ({
  id: `${roleId}-${kind}-${now.getTime().toString(36)}-${state.approvals.filter((a) => a.roleId === roleId && a.kind === kind).length}`,
  kind,
  roleId,
  status: 'pending',
  requestedAt: now.toISOString(),
  decidedAt: null,
});

export function requestHire(state: HiringState, roleId: string, now: Date): HiringState {
  const check = canHire(state, roleId);
  const role = specialistById(roleId);
  if (check !== 'ok' || !role) throw new Error(`cannot hire ${roleId}: ${check}`);
  const lotId = freeLot(state, role.district) as string;
  const hire: Hire = { roleId: role.id, lotId, status: 'pending', requestedAt: now.toISOString() };
  return { hires: [...state.hires, hire], approvals: [...state.approvals, approval(state, 'hire', role.id, now)] };
}

export function requestRetire(state: HiringState, roleId: string, now: Date): HiringState {
  const hire = state.hires.find((h) => h.roleId === roleId && h.status === 'active');
  const waiting = state.approvals.some((a) => a.roleId === roleId && a.status === 'pending');
  if (!hire || waiting) throw new Error(`cannot retire ${roleId}: not active`);
  return { ...state, approvals: [...state.approvals, approval(state, 'retire', hire.roleId, now)] };
}

export function decide(state: HiringState, approvalId: string, approve: boolean, now: Date): HiringState {
  const target = state.approvals.find((a) => a.id === approvalId);
  if (!target || target.status !== 'pending') throw new Error(`approval ${approvalId} not pending`);
  const updated = state.approvals.map((a) =>
    a.id === approvalId ? { ...a, status: approve ? ('approved' as const) : ('rejected' as const), decidedAt: now.toISOString() } : a,
  );
  const decided = updated.filter((a) => a.status !== 'pending');
  const approvals = updated.filter((a) => a.status === 'pending' || decided.slice(-DECIDED_HISTORY).includes(a));
  const removes = (target.kind === 'hire' && !approve) || (target.kind === 'retire' && approve);
  const hires = removes
    ? state.hires.filter((h) => h.roleId !== target.roleId)
    : state.hires.map((h) => (h.roleId === target.roleId && target.kind === 'hire' ? { ...h, status: 'active' as const } : h));
  return { hires, approvals };
}

export const activeHires = (state: HiringState): Hire[] => state.hires.filter((h) => h.status === 'active');
export const pendingApprovals = (state: HiringState): Approval[] => state.approvals.filter((a) => a.status === 'pending');
