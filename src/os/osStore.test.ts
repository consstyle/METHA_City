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

test('syncSpecialists añade y quita especialistas según las contrataciones activas', () => {
  const store = createOsStore({ now: () => NOW });
  store.getState().syncSpecialists(['bim', 'it']);
  const ids = () => store.getState().sim.agents.filter((a) => a.kind === 'specialist').map((a) => a.id);
  assert.deepEqual(ids(), ['bim', 'it']);
  assert.deepEqual(store.getState().specialists, ['bim', 'it']);
  const before = store.getState().sim;
  store.getState().syncSpecialists(['it', 'bim']);
  assert.equal(store.getState().sim, before, 'sin cambios no se notifica');
  store.getState().syncSpecialists(['it']);
  assert.deepEqual(ids(), ['it']);
});

test('setPins ocupa a los agentes al momento y record añade eventos de misión', () => {
  let t = NOW.getTime();
  const store = createOsStore({ now: () => new Date(t) });
  store.getState().setPins({ bau: 'Montageplan prüfen' });
  const bau = () => store.getState().sim.agents.find((a) => a.id === 'bau')!;
  assert.deepEqual([bau().state, bau().focus], ['working', 'Montageplan prüfen']);
  const before = store.getState().sim;
  store.getState().setPins({ bau: 'Montageplan prüfen' });
  assert.equal(store.getState().sim, before, 'mismos pins: sin cambios');
  t += SIMULATION_INTERVAL_MS;
  store.getState().tick();
  assert.equal(bau().focus, 'Montageplan prüfen', 'el paso del motor respeta el pin');
  store.getState().record([{ type: 'completed', agentId: 'bau', targetAgentId: null, note: 'Montageplan prüfen', at: new Date(t).toISOString() }]);
  assert.equal(store.getState().sim.activity.at(-1)!.note, 'Montageplan prüfen');
  store.getState().record([]);
  store.getState().setPins({});
  assert.deepEqual([bau().state, bau().focus], ['idle', null]);
});
