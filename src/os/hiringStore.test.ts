import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KeyValueStore } from '@/lib/storage';
import { activeHires, pendingApprovals } from './hiring';
import { createAgentSettingsStore, createHiringStore } from './hiringStore';

const memory = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const NOW = () => new Date('2026-10-22T09:00:00Z');

test('el store de contrataciones aplica las reglas y persiste', () => {
  const kv = memory();
  const store = createHiringStore({ now: NOW, getStore: () => kv });
  assert.equal(store.getState().request('bim'), 'ok');
  assert.equal(store.getState().request('bim'), 'already');
  const approval = pendingApprovals(store.getState().hiring)[0]!;
  store.getState().decide(approval.id, true);
  assert.deepEqual(activeHires(store.getState().hiring).map((h) => h.roleId), ['bim']);
  assert.equal(store.getState().retire('bim'), true);
  assert.equal(store.getState().retire('bim'), false, 'ya hay una baja pendiente');
  assert.equal(store.getState().decide('nope', true), false);

  const reloaded = createHiringStore({ now: NOW, getStore: () => kv });
  assert.deepEqual(reloaded.getState().hiring, store.getState().hiring);

  // Otra pestaña decide la baja; reload trae su estado.
  reloaded.getState().decide(pendingApprovals(reloaded.getState().hiring)[0]!.id, true);
  store.getState().reload();
  assert.deepEqual(activeHires(store.getState().hiring), []);
});

test('instrucciones permanentes por agente: guardar, restablecer y persistir', () => {
  const kv = memory();
  const store = createAgentSettingsStore({ getStore: () => kv });
  assert.equal(store.getState().instructionsFor('bau'), null);
  store.getState().setInstructions('bau', '  Immer auf Schweizerdeutsch grüssen.  ');
  assert.equal(store.getState().instructionsFor('bau'), 'Immer auf Schweizerdeutsch grüssen.');
  const other = createAgentSettingsStore({ getStore: () => kv });
  assert.equal(other.getState().instructionsFor('bau'), 'Immer auf Schweizerdeutsch grüssen.');
  other.getState().setInstructions('chief', 'Wochenbericht am Freitag.');
  store.getState().reload();
  assert.equal(store.getState().instructionsFor('chief'), 'Wochenbericht am Freitag.');
  store.getState().setInstructions('bau', '   ');
  assert.equal(store.getState().instructionsFor('bau'), null, 'vacío = valor por defecto');
  assert.throws(() => store.getState().setInstructions('bau', 'x'.repeat(2001)), /too long/);
});
