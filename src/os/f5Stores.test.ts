import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import type { KeyValueStore } from '@/lib/storage';
import { createJournalStore } from './journalStore';
import { PLANNING_MS, STEP_MS } from './missions/mission';
import { createMissionsStore, MISSION_LIMIT } from './missions/missionsStore';
import type { ExternalEvent } from './simulation/engine';
import { createTasksStore } from './tasks/tasksStore';

const m = getMessages();
const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const T0 = new Date('2026-10-22T08:00:00Z').getTime();

test('store de misiones: validar, crear, avanzar, decidir, cancelar y persistir', () => {
  const kv = memory();
  let t = T0;
  const events: ExternalEvent[] = [];
  const store = createMissionsStore({ m, now: () => new Date(t), getStore: () => kv, onEvents: (e) => events.push(...e) });
  assert.deepEqual(store.getState().create({ objective: 'kurz', expected: '', length: 'kurz' }, null, []), { ok: false, reason: 'invalid' }, 'objetivo demasiado corto');
  assert.deepEqual(store.getState().create({ objective: 'Montagen planen', expected: '', length: 'nope' }, null, []), { ok: false, reason: 'invalid' });
  const created = store.getState().create({ objective: '  Montagen planen ', expected: '', length: 'mittel' }, null, []);
  assert.ok(created.ok);
  const id = created.id;
  assert.equal(store.getState().missions[0]!.objective, 'Montagen planen');
  assert.deepEqual(events.map((e) => e.type), ['started']);

  assert.deepEqual(store.getState().tick(), [], 'aún planificando');
  t += PLANNING_MS;
  assert.equal(store.getState().tick().length, 1);
  assert.equal(store.getState().missions[0]!.status, 'awaiting-plan');
  assert.equal(store.getState().decide(id, 'result', true), false, 'transición no válida');
  assert.equal(store.getState().decide(id, 'plan', true), true);
  assert.equal(events.at(-1)!.type, 'delegated');
  t += STEP_MS;
  store.getState().tick();
  assert.equal(store.getState().missions[0]!.steps.filter((s) => s.status === 'done').length, 2);

  const reloaded = createMissionsStore({ m, now: () => new Date(t), getStore: () => kv });
  assert.deepEqual(reloaded.getState().missions, store.getState().missions);
  assert.equal(store.getState().cancel(id), true);
  assert.equal(store.getState().cancel(id), false);
  assert.equal(store.getState().decide('nope', 'plan', true), false);
  reloaded.getState().reload();
  assert.equal(reloaded.getState().missions[0]!.status, 'cancelled');
});

const createId = (store: ReturnType<typeof createMissionsStore>, objective: string) => {
  const r = store.getState().create({ objective, expected: '', length: 'kurz' }, null, []);
  if (!r.ok) throw new Error(r.reason);
  return r.id;
};

test('límite de misiones: se descartan primero las terminadas; con todas abiertas no se crea otra', () => {
  let t = T0;
  const store = createMissionsStore({ m, now: () => new Date(t), getStore: () => memory() });
  const first = createId(store, 'Erste Mission');
  store.getState().cancel(first);
  for (let i = 0; i < MISSION_LIMIT; i++) {
    t += 1000;
    createId(store, `Mission Nummer ${i}`);
  }
  assert.equal(store.getState().missions.length, MISSION_LIMIT);
  assert.equal(store.getState().missions.some((x) => x.id === first), false, 'la terminada sale primero');
  assert.deepEqual(store.getState().create({ objective: 'Noch eine Mission', expected: '', length: 'kurz' }, null, []), { ok: false, reason: 'limit' });
  assert.equal(store.getState().missions.length, MISSION_LIMIT, 'ninguna abierta se pierde');
});

test('dos pestañas: cada acción parte de lo último guardado y no pisa a la otra', () => {
  const kv = memory();
  let t = T0;
  const a = createMissionsStore({ m, now: () => new Date(t), getStore: () => kv });
  const id = createId(a, 'Montagen planen');
  t += PLANNING_MS;
  a.getState().tick();
  const b = createMissionsStore({ m, now: () => new Date(t), getStore: () => kv });
  assert.equal(a.getState().decide(id, 'plan', true), true);
  // B aún tiene la copia vieja («awaiting-plan»); al crear otra misión no debe revertir la decisión de A.
  createId(b, 'Material bestellen');
  const stored = createMissionsStore({ m, now: () => new Date(t), getStore: () => kv }).getState().missions;
  assert.equal(stored.find((x) => x.id === id)!.status, 'running');
  assert.equal(stored.length, 2);
});

test('store de tareas y diario', () => {
  const kv = memory();
  const tasks = createTasksStore({ now: () => new Date(T0), getStore: () => kv });
  assert.equal(tasks.getState().add('   ', null), null);
  const id = tasks.getState().add('Lieferschein prüfen', 'werkhof')!;
  tasks.getState().move(id, 'erledigt');
  assert.equal(createTasksStore({ getStore: () => kv }).getState().board.tasks[0]!.status, 'erledigt');
  tasks.getState().remove(id);
  assert.deepEqual(tasks.getState().board.tasks, []);
  tasks.getState().reload();
  assert.deepEqual(tasks.getState().board.tasks, []);

  const journal = createJournalStore({ getStore: () => kv });
  const entry = { id: 'e1', at: new Date(T0).toISOString(), kind: 'mission' as const, agentId: null, text: 'Hallo' };
  journal.getState().add([entry]);
  const before = journal.getState().entries;
  journal.getState().add([entry]);
  assert.equal(journal.getState().entries, before, 'sin cambios no se notifica');
  assert.equal(createJournalStore({ getStore: () => kv }).getState().entries.length, 1);
});
