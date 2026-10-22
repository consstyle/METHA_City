import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, ellipsePoints } from './builder';
import { dotProgress, isRouteActive } from './links';

test('isRouteActive reconoce la delegación por su ruta; la coordinación vale en ambos sentidos', () => {
  const h = { from: 'avor', to: 'werkhof', kind: 'hierarchy' } as const;
  const c = { from: 'avor', to: 'einkauf', kind: 'coordination' } as const;
  assert.equal(isRouteActive(h, [{ from: 'avor', to: 'werkhof' }]), true);
  assert.equal(isRouteActive(h, [{ from: 'werkhof', to: 'avor' }]), false);
  assert.equal(isRouteActive(c, [{ from: 'einkauf', to: 'avor' }]), true);
  assert.equal(isRouteActive(c, []), false);
});

test('createRandom reproduce la secuencia de preview.html (semilla 16)', () => {
  const a = createRandom();
  const b = createRandom();
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(Array.from({ length: 5 }, b), seqA);
  // primer valor: (16 * 1664525 + 1013904223) >>> 0 / 2^32
  assert.equal(seqA[0], ((16 * 1664525 + 1013904223) >>> 0) / 4294967296);
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

test('ellipsePoints genera un contorno cerrado de 129 puntos a la altura pedida', () => {
  const pts = ellipsePoints(24.4, 16.3, 0.05);
  assert.equal(pts.length, 129);
  const first = pts[0] as readonly number[];
  const last = pts[128] as readonly number[];
  assert.ok(Math.abs((first[0] ?? 0) - (last[0] ?? 0)) < 1e-9 && Math.abs((first[2] ?? 0) - (last[2] ?? 0)) < 1e-9);
  assert.ok(pts.every((p) => p[1] === 0.05));
});

test('dotProgress reparte los puntos y hace circular la coordinación en ambos sentidos', () => {
  assert.equal(dotProgress(0, 0, 2, 0, false), 0);
  assert.equal(dotProgress(0, 1, 2, 0, false), 0.5);
  assert.ok(Math.abs(dotProgress(0.1, 0, 2, 1, false) - 0.27) < 1e-9);
  // en coordinación, los puntos impares van en sentido contrario
  assert.equal(dotProgress(0.1, 1, 4, 0, true), 1 - ((0.1 + 0.25) % 1));
  assert.ok(dotProgress(5.3, 0, 2, 0, false) < 1);
});
