import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createJsonStorage, type KeyValueStore } from './storage';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const Schema = z.object({ n: z.number() });

test('guarda y lee valores validados con zod bajo una clave versionada', () => {
  const kv = memory();
  const store = createJsonStorage('methacity.test', 1, Schema, () => kv);
  assert.equal(store.load(), null);
  store.save({ n: 3 });
  assert.deepEqual(JSON.parse(kv.data.get('methacity.test.v1')!), { n: 3 });
  assert.deepEqual(store.load(), { n: 3 });
});

test('datos corruptos o de otra forma se descartan y se borran', () => {
  const kv = memory();
  kv.data.set('methacity.test.v1', '{nope');
  const store = createJsonStorage('methacity.test', 1, Schema, () => kv);
  assert.equal(store.load(), null);
  assert.equal(kv.data.has('methacity.test.v1'), false);
  kv.data.set('methacity.test.v1', JSON.stringify({ n: 'x' }));
  assert.equal(store.load(), null);
});

test('sin almacenamiento disponible (modo privado, servidor) no falla', () => {
  const broken: KeyValueStore = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('denied'); },
  };
  const store = createJsonStorage('methacity.test', 1, Schema, () => broken);
  assert.equal(store.load(), null);
  assert.equal(store.save({ n: 1 }), false, 'avisa de que no se guardó (cuota)');
  const none = createJsonStorage('methacity.test', 1, Schema, () => null);
  assert.equal(none.load(), null);
  assert.equal(none.save({ n: 1 }), false);
  assert.equal(createJsonStorage('methacity.test', 1, Schema, () => memory()).save({ n: 1 }), true);
});
