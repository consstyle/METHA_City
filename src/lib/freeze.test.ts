import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepFreeze } from './freeze';

test('deepFreeze congela todos los niveles', () => {
  const value = deepFreeze({ a: { b: [{ c: 1 }] } });
  assert.ok(Object.isFrozen(value.a.b[0]));
});

test('deepFreeze también entra en objetos ya congelados por arriba', () => {
  const inner = { c: 1 };
  deepFreeze(Object.freeze({ inner }));
  assert.ok(Object.isFrozen(inner));
});

test('deepFreeze deja pasar valores primitivos y null', () => {
  assert.equal(deepFreeze(3), 3);
  assert.equal(deepFreeze(null), null);
});
