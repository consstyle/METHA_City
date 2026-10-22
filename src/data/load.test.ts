import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { loadSnapshot } from './load';
import { MockDataSource } from './mock/MockDataSource';
import type { CitySnapshot } from './contract';

function silence(method: 'error' | 'warn') {
  return mock.method(console, method, () => undefined);
}

test('loadSnapshot devuelve el snapshot cuando la fuente responde', async () => {
  const result = await loadSnapshot(new MockDataSource());
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.snapshot.units.length, 6);
});

test('loadSnapshot convierte un fallo en { ok: false } y registra el error completo', async () => {
  const errorLog = silence('error');
  try {
    assert.deepEqual(await loadSnapshot(new MockDataSource({ scenario: 'fehler' })), { ok: false });
    assert.equal(errorLog.mock.callCount(), 1);
    assert.ok(errorLog.mock.calls[0]?.arguments[1] instanceof Error);
  } finally {
    errorLog.mock.restore();
  }
});

test('loadSnapshot valida lo que entrega cualquier fuente', async () => {
  const errorLog = silence('error');
  try {
    const broken = { getSnapshot: async () => ({ source: 'live', units: 'no' }) as unknown as CitySnapshot };
    assert.deepEqual(await loadSnapshot(broken), { ok: false });
    assert.equal(errorLog.mock.callCount(), 1);
  } finally {
    errorLog.mock.restore();
  }
});

test('una cancelación o un tiempo agotado se registran como aviso, no como error', async () => {
  const warnLog = silence('warn');
  const errorLog = silence('error');
  try {
    const ctrl = new AbortController();
    ctrl.abort();
    assert.deepEqual(await loadSnapshot(new MockDataSource(), { signal: ctrl.signal }), { ok: false });
    const slow = new MockDataSource({ delayMs: 1_000 });
    assert.deepEqual(await loadSnapshot(slow, { signal: AbortSignal.timeout(10) }), { ok: false });
    assert.equal(warnLog.mock.callCount(), 2);
    assert.equal(errorLog.mock.callCount(), 0);
  } finally {
    warnLog.mock.restore();
    errorLog.mock.restore();
  }
});

test('loadSnapshot registra también errores que no son instancias de Error', async () => {
  const errorLog = silence('error');
  try {
    assert.deepEqual(await loadSnapshot({ getSnapshot: () => Promise.reject('texto') }), { ok: false });
    assert.equal(errorLog.mock.calls[0]?.arguments[1], 'texto');
  } finally {
    errorLog.mock.restore();
  }
});
