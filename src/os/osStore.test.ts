import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOsStore, SIMULATION_INTERVAL_MS } from './osStore';

const NOW = new Date('2026-10-21T10:00:00Z');

test('sin precalentamiento el sistema arranca vacío', () => {
  const s = createOsStore({ now: () => NOW }).getState().sim;
  assert.equal(s.tick, 0);
  assert.equal(s.activity.length, 0);
});

test('el precalentamiento simula pasos en el pasado y termina en el instante actual', () => {
  const s = createOsStore({ now: () => NOW, warmup: 24 }).getState().sim;
  assert.equal(s.tick, 24);
  assert.ok(s.activity.length > 0);
  assert.equal(s.now, NOW.toISOString());
  const first = Date.parse(s.activity[0]!.at);
  assert.ok(first >= NOW.getTime() - 24 * SIMULATION_INTERVAL_MS && first <= NOW.getTime());
});

test('tick avanza un paso y avisa a los suscriptores', () => {
  let t = NOW.getTime();
  const store = createOsStore({ now: () => new Date(t) });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  t += SIMULATION_INTERVAL_MS;
  store.getState().tick();
  assert.equal(store.getState().sim.tick, 1);
  assert.equal(calls, 1);
});
