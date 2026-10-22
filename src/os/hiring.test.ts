import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeHires, canHire, decide, EMPTY_HIRING, freeLot, HiringStateSchema, pendingApprovals, requestHire, requestRetire,
} from './hiring';

const T0 = new Date('2026-10-22T08:00:00Z');
const T1 = new Date('2026-10-22T08:05:00Z');

test('solicitar una contratación reserva un solar y crea una Freigabe pendiente (D13)', () => {
  const s = requestHire(EMPTY_HIRING, 'bim', T0);
  assert.equal(s.hires.length, 1);
  assert.deepEqual({ ...s.hires[0], lotId: undefined }, { roleId: 'bim', status: 'pending', requestedAt: T0.toISOString(), lotId: undefined });
  assert.match(s.hires[0]!.lotId, /^p\d$/);
  assert.equal(pendingApprovals(s).length, 1);
  assert.equal(pendingApprovals(s)[0]!.kind, 'hire');
  assert.deepEqual(activeHires(s), []);
  assert.deepEqual(EMPTY_HIRING.hires, [], 'no muta el estado anterior');
});

test('aprobar activa el especialista; rechazar libera el solar', () => {
  const s = requestHire(EMPTY_HIRING, 'bim', T0);
  const id = pendingApprovals(s)[0]!.id;
  const approved = decide(s, id, true, T1);
  assert.deepEqual(activeHires(approved).map((h) => h.roleId), ['bim']);
  assert.equal(approved.approvals[0]!.status, 'approved');
  assert.equal(approved.approvals[0]!.decidedAt, T1.toISOString());
  const rejected = decide(s, id, false, T1);
  assert.deepEqual(rejected.hires, []);
  assert.equal(rejected.approvals[0]!.status, 'rejected');
});

test('retirar también pasa por una Freigabe y libera el solar al aprobarse', () => {
  let s = requestHire(EMPTY_HIRING, 'recht', T0);
  s = decide(s, pendingApprovals(s)[0]!.id, true, T0);
  s = requestRetire(s, 'recht', T1);
  assert.equal(pendingApprovals(s)[0]!.kind, 'retire');
  assert.equal(activeHires(s).length, 1, 'sigue activo mientras espera');
  const kept = decide(s, pendingApprovals(s)[0]!.id, false, T1);
  assert.equal(activeHires(kept).length, 1);
  const gone = decide(s, pendingApprovals(s)[0]!.id, true, T1);
  assert.deepEqual(gone.hires, []);
});

test('no se contrata dos veces ni sin solar libre en el distrito (D14)', () => {
  let s = requestHire(EMPTY_HIRING, 'bim', T0);
  assert.equal(canHire(s, 'bim'), 'already');
  assert.throws(() => requestHire(s, 'bim', T0), /already/);
  for (const role of ['kalkulation', 'terminplanung', 'recht']) s = requestHire(s, role, T0);
  assert.equal(freeLot(s, 'project'), null);
  assert.equal(canHire(s, 'kundendienst'), 'no-lot');
  assert.equal(canHire(s, 'personal'), 'ok', 'el otro distrito sigue libre');
  assert.equal(canHire(s, 'nope'), 'unknown');
  const lots = s.hires.map((h) => h.lotId);
  assert.equal(new Set(lots).size, lots.length, 'cada uno en su solar');
});

test('no se retira lo que no está activo ni se decide dos veces', () => {
  const s = requestHire(EMPTY_HIRING, 'bim', T0);
  assert.throws(() => requestRetire(s, 'bim', T1), /not active/);
  const id = pendingApprovals(s)[0]!.id;
  const done = decide(s, id, true, T1);
  assert.throws(() => decide(done, id, true, T1), /not pending/);
  assert.throws(() => decide(done, 'x', true, T1), /not pending/);
});

test('el estado persistido se valida con zod, incluidas las reglas del dominio', () => {
  const requested = requestHire(EMPTY_HIRING, 'it', T0);
  const s = decide(requested, pendingApprovals(requested)[0]!.id, true, T1);
  assert.deepEqual(HiringStateSchema.parse(JSON.parse(JSON.stringify(s))), s);
  assert.equal(HiringStateSchema.safeParse({ hires: [{ roleId: 'it' }], approvals: [] }).success, false);
  const hire = s.hires[0]!;
  const bad = (state: unknown) => assert.equal(HiringStateSchema.safeParse(state).success, false, JSON.stringify(state));
  bad({ ...s, hires: [{ ...hire, lotId: 'x9' }] });
  bad({ ...s, hires: [{ ...hire, lotId: 'p1' }] });
  bad({ ...s, hires: [hire, { ...hire, roleId: 'personal' }] });
  bad({ hires: [], approvals: [{ ...s.approvals[0]!, status: 'pending' }] });
  bad({ ...s, approvals: [s.approvals[0]!, s.approvals[0]!] });
});

test('el historial de Freigaben decididas se recorta y los ids siguen siendo únicos', () => {
  let s = EMPTY_HIRING;
  for (let i = 0; i < 60; i++) {
    const at = new Date(T0.getTime() + i * 1000);
    s = requestHire(s, 'it', at);
    s = decide(s, pendingApprovals(s)[0]!.id, false, at);
  }
  assert.equal(s.approvals.length, 50);
  assert.equal(new Set(s.approvals.map((a) => a.id)).size, 50);
  assert.ok(HiringStateSchema.safeParse(s).success);
});
