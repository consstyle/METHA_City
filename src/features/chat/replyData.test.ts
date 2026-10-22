import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockDataSource } from '@/data/mock/MockDataSource';
import { createSimulation } from '@/os/simulation/engine';
import { addSpecialist } from '@/os/simulation/roster';
import { replyData } from './replyData';

const T = new Date('2026-10-22T09:00:00Z');
const ok = async () => ({ ok: true as const, snapshot: await new MockDataSource({ scenario: 'normal', now: () => T }).getSnapshot() });

test('una unidad responde con sus números de MethaDesk', async () => {
  const result = await ok();
  const d = replyData('bauleitung', createSimulation(1, T), result);
  const unit = result.snapshot.units.find((u) => u.unitId === 'bauleitung')!;
  assert.deepEqual(d.kpis, { kind: 'unit', hasData: unit.hasData, open: unit.ts.offen, total: unit.ts.total, overdue: unit.alerts.montageUeberfaellig, rework: unit.alerts.nachbearbeitung });
  assert.equal(d.agent?.id, 'bauleitung');
});

test('el Chief suma las alertas de todas las unidades con datos', async () => {
  const result = await ok();
  const d = replyData('chief', createSimulation(1, T), result);
  const sum = (k: 'montageUeberfaellig' | 'nachbearbeitung') => result.snapshot.units.filter((u) => u.hasData).reduce((s, u) => s + u.alerts[k], 0);
  assert.deepEqual(d.kpis, { kind: 'all', overdue: sum('montageUeberfaellig'), rework: sum('nachbearbeitung') });
});

test('especialistas, error de datos y sistema aún sin arrancar', async () => {
  const sim = addSpecialist(createSimulation(1, T), 'bim');
  assert.deepEqual(replyData('bim', sim, await ok()).kpis, { kind: 'specialist' });
  assert.deepEqual(replyData('bim', sim, await ok()).specialists, ['bim']);
  assert.deepEqual(replyData('bau', sim, { ok: false }).kpis, { kind: 'unavailable' });
  const early = replyData('chief', null, { ok: false });
  assert.deepEqual([early.agent, early.kpis, early.specialists], [undefined, { kind: 'unavailable' }, []]);
});
