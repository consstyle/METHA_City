import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_DEFAULTS, LIMITS, applyDrag, applyPinch, applyWheel, blendFactor, clampPitch, clampZoom,
  REFERENCE_ASPECT, fitFactor, focusTargetFor, frustum, orbitPosition, sceneExtent,
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

test('el encuadre solo se abre lo justo para ver las obras, y el zoom máximo crece igual', () => {
  assert.equal(sceneExtent([]), 1);
  assert.equal(sceneExtent([{ x: 0, z: -24 }]), 1, 'detrás de la isla (arriba en pantalla) cabe sin abrir');
  const left = sceneExtent([{ x: -60, z: 0 }]);
  assert.ok(left > 1.5, 'muy a la izquierda hay que abrir');
  assert.ok(sceneExtent([{ x: -60, z: 0 }], 2.5) < left, 'en una pantalla ancha, menos');
  close(frustum(2, 1, left).right, frustum(2, 1).right * left);
  assert.equal(clampZoom(10, left), LIMITS.zoomMax * left);
  assert.equal(applyWheel(LIMITS.zoomMax, -2000, left), Math.min(LIMITS.zoomMax * Math.exp(2), LIMITS.zoomMax * left));
  assert.equal(applyPinch(1, 100, 1000, left), LIMITS.zoomMax * left);
});

test('fitFactor proyecta como la cámara por defecto y deja libre la zona del título', () => {
  const f = frustum(REFERENCE_ASPECT, 1);
  close(fitFactor({ x: 0, y: 0.3, z: 0 }), 0, 1e-9);
  // Un punto en el borde derecho del encuadre (sobre la línea del centro) necesita 1 / margen lateral.
  const yaw = 0.18;
  const edge = { x: f.right * Math.cos(yaw), y: 0.3, z: -f.right * Math.sin(yaw) };
  close(fitFactor(edge), 1 / 0.93, 1e-9);
  const titleSpot = { x: -0.6 * f.right * Math.cos(yaw), y: 0.3 + (0.6 * f.top) / Math.cos(0.66), z: 0.6 * f.right * Math.sin(yaw) };
  assert.ok(fitFactor(titleSpot) > 1, 'bajo el título no se considera visible');
});
