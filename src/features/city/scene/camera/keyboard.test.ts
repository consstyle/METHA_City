import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PITCH_STEP, YAW_STEP, ZOOM_STEP } from './cameraMath';
import { handleCameraKey } from './keyboard';

function recorder() {
  const calls: [string, number?][] = [];
  return {
    calls,
    actions: {
      rotateBy: (d: number) => calls.push(['rotateBy', d]),
      tiltBy: (d: number) => calls.push(['tiltBy', d]),
      zoomBy: (f: number) => calls.push(['zoomBy', f]),
      reset: () => calls.push(['reset']),
    },
  };
}

test('las flechas, + / − e Inicio / Esc se traducen en acciones de cámara', () => {
  const { calls, actions } = recorder();
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home', 'Escape']) {
    assert.equal(handleCameraKey(key, actions), true, key);
  }
  assert.deepEqual(calls, [
    ['rotateBy', -YAW_STEP], ['rotateBy', YAW_STEP], ['tiltBy', PITCH_STEP], ['tiltBy', -PITCH_STEP],
    ['zoomBy', ZOOM_STEP], ['zoomBy', ZOOM_STEP], ['zoomBy', 1 / ZOOM_STEP], ['reset'], ['reset'],
  ]);
});

test('las demás teclas no hacen nada y no se interceptan', () => {
  const { calls, actions } = recorder();
  assert.equal(handleCameraKey('a', actions), false);
  assert.equal(handleCameraKey('Tab', actions), false);
  assert.deepEqual(calls, []);
});
