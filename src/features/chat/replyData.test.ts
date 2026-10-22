import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockDataSource } from '@/data/mock/MockDataSource';
import { createSimulation } from '@/os/simulation/engine';
import { addSpecialist, syncProjectAgents } from '@/os/simulation/roster';
import { replyData, teamsOf } from './replyData';

const T = new Date('2026-10-22T09:00:00Z');
const ok = async () => ({ ok: true as const, snapshot: await new MockDataSource({ scenario: 'normal', now: () => T }).getSnapshot() });
const TEAMS = [
  { projektId: 'mock-DEV-001', agents: { pl: 'pl-dev-001', bl: 'bl-dev-001' } },
  { projektId: 'mock-DEV-002', agents: { pl: 'pl-dev-002', bl: 'bl-dev-002' } },
];

test('una unidad responde con sus números de MethaDesk', async () => {
  const result = await ok();
  const d = replyData('werkhof', createSimulation(1, T), result);
  const unit = result.snapshot.units.find((u) => u.unitId === 'werkhof')!;
  assert.deepEqual(d.kpis, { kind: 'unit', hasData: unit.hasData, open: unit.ts.offen, total: unit.ts.total, overdue: unit.alerts.montageUeberfaellig, rework: unit.alerts.nachbearbeitung });
  assert.equal(d.agent?.id, 'werkhof');
});

test('el Chief suma las alertas del campus y de las obras', async () => {
  const result = await ok();
  const d = replyData('chief', createSimulation(1, T), result);
  const units = result.snapshot.units.filter((u) => u.hasData);
  const { projects } = result.snapshot;
  assert.deepEqual(d.kpis, {
    kind: 'all',
    overdue: units.reduce((s, u) => s + u.alerts.montageUeberfaellig, 0) + projects.reduce((s, p) => s + p.montageUeberfaellig, 0),
    rework: units.reduce((s, u) => s + u.alerts.nachbearbeitung, 0) + projects.reduce((s, p) => s + p.nachbearbeitung, 0),
  });
});

test('la Bauleitung de un proyecto responde con los números de su proyecto', async () => {
  const result = await ok();
  const sim = syncProjectAgents(createSimulation(1, T), TEAMS);
  const p = result.snapshot.projects.find((x) => x.projektId === 'mock-DEV-002')!;
  assert.deepEqual(replyData('bl-dev-002', sim, result).kpis, {
    kind: 'project', projekt: 'DEV-002', total: p.tsTotal, verbaut: p.tsVerbaut, overdue: p.montageUeberfaellig, rework: p.nachbearbeitung,
  });
  // Un proyecto que ya no está en los datos: no se inventan números.
  const orphan = syncProjectAgents(createSimulation(1, T), [{ projektId: 'otro', agents: { pl: 'pl-x', bl: 'bl-x' } }]);
  assert.deepEqual(replyData('pl-x', orphan, result).kpis, { kind: 'unavailable' });
});

test('teamsOf reconstruye los equipos de proyecto a partir de los agentes', () => {
  const sim = syncProjectAgents(createSimulation(1, T), TEAMS);
  assert.deepEqual(teamsOf(sim), TEAMS);
  assert.deepEqual(teamsOf(null), []);
});

test('especialistas, error de datos y sistema aún sin arrancar', async () => {
  const sim = addSpecialist(createSimulation(1, T), 'bim');
  assert.deepEqual(replyData('bim', sim, await ok()).kpis, { kind: 'specialist' });
  assert.deepEqual(replyData('bim', sim, await ok()).specialists, ['bim']);
  assert.deepEqual(replyData('werkhof', sim, { ok: false }).kpis, { kind: 'unavailable' });
  const early = replyData('chief', null, { ok: false });
  assert.deepEqual([early.agent, early.kpis, early.specialists], [undefined, { kind: 'unavailable' }, []]);
});
