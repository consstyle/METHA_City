import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_DEFAULTS, LIMITS, applyDrag, applyPinch, applyWheel, blendFactor, clampPitch, clampZoom,
  focusTargetFor, frustum, orbitPosition,
} from './cameraMath';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('los valores por defecto son los de preview.html', () => {
  assert.deepEqual(CAMERA_DEFAULTS, { yaw: 0.18, pitch: 0.66, zoom: 1, target: [0, 0.3, 0] });
});

test('frustum reproduce el encuadre del HTML: altura mínima 34 y reparto 59 % / 41 %', () => {
  const wide = frustum(2, 1); // 54/2 = 27 < 34 → 34
  close(wide.top - wide.bottom, 34);
  close(wide.top, 34 * 0.59);
  close(wide.right, (34 * 2) / 2);
  const tall = frustum(0.5, 1); // 54/0.5 = 108
  close(tall.top - tall.bottom, 108);
  const zoomed = frustum(2, 2);
  close(zoomed.top - zoomed.bottom, 17);
});

test('orbitPosition coloca la cámara a 65 unidades del objetivo según giro e inclinación', () => {
  const [x, y, z] = orbitPosition([0, 0.3, 0], 0, Math.PI / 2, 65);
  close(x, 0);
  close(y, 65.3);
  close(z, 0, 1e-6);
  const p = orbitPosition([1, 0, 2], 0.18, 0.66, 65);
  close(Math.hypot(p[0] - 1, p[1], p[2] - 2), 65);
});

test('inclinación y zoom se limitan como en el HTML', () => {
  assert.equal(clampPitch(0), LIMITS.pitchMin);
  assert.equal(clampPitch(2), LIMITS.pitchMax);
  assert.equal(clampZoom(0.1), LIMITS.zoomMin);
  assert.equal(clampZoom(10), LIMITS.zoomMax);
  assert.deepEqual(LIMITS, { pitchMin: 0.3, pitchMax: 1.45, zoomMin: 0.72, zoomMax: 2.8 });
});

test('arrastrar gira e inclina con la sensibilidad del HTML', () => {
  const r = applyDrag({ yaw: 0.18, pitch: 0.66 }, 100, -50);
  close(r.yaw, 0.18 - 0.6);
  close(r.pitch, 0.66 - 0.2);
  assert.equal(applyDrag({ yaw: 0, pitch: 0.66 }, 0, 10_000).pitch, LIMITS.pitchMax);
});

test('la rueda y el pellizco cambian el zoom dentro de los límites', () => {
  close(applyWheel(1, -100), Math.exp(0.1));
  assert.equal(applyWheel(1, 100_000), LIMITS.zoomMin);
  close(applyPinch(1, 100, 150), 1.5);
  assert.equal(applyPinch(2, 100, 1000), LIMITS.zoomMax);
  assert.equal(applyPinch(1, 0, 50), 1, 'sin distancia inicial no cambia');
});

test('la amortiguación es instantánea con movimiento reducido', () => {
  assert.equal(blendFactor(0.03, true), 1);
  close(blendFactor(0.03, false), 1 - Math.exp(-0.24));
});

test('el enfoque apunta al edificio a un 35 % de su altura', () => {
  assert.deepEqual(focusTargetFor({ position: { x: -6, z: -1 }, size: { h: 8.8 } }), [-6, 8.8 * 0.35, -1]);
});
