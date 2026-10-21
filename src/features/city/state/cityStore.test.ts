import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_DEFAULTS, LIMITS, TOP_VIEW_PITCH, FOCUS_ZOOM } from '@/features/city/scene/camera/cameraMath';
import { createCityStore } from './cityStore';

test('el estado inicial es el de preview.html', () => {
  const s = createCityStore().getState();
  assert.equal(s.selected, 'avor');
  assert.equal(s.view, 'city');
  assert.deepEqual(s.options, { auto: false, links: true, tags: true, day: false });
  assert.equal(s.camera.yaw, CAMERA_DEFAULTS.yaw);
  assert.equal(s.camera.topView, false);
  assert.equal(s.camera.focus, null);
});

test('select solo acepta unidades existentes', () => {
  const store = createCityStore();
  store.getState().select('bau');
  assert.equal(store.getState().selected, 'bau');
  store.getState().select('no-existe');
  assert.equal(store.getState().selected, 'bau');
});

test('toggle cambia cada opción sin tocar las demás', () => {
  const store = createCityStore();
  store.getState().toggle('day');
  store.getState().toggle('links');
  assert.deepEqual(store.getState().options, { auto: false, links: false, tags: true, day: true });
});

test('zoomBy multiplica y respeta los límites', () => {
  const store = createCityStore();
  store.getState().zoomBy(1.15);
  assert.equal(store.getState().camera.zoom, 1.15);
  for (let i = 0; i < 50; i++) store.getState().zoomBy(1.15);
  assert.equal(store.getState().camera.zoom, LIMITS.zoomMax);
});

test('la vista aérea alterna la inclinación y se apaga al restablecer', () => {
  const store = createCityStore();
  store.getState().toggleTopView();
  assert.equal(store.getState().camera.pitch, TOP_VIEW_PITCH);
  assert.equal(store.getState().camera.topView, true);
  store.getState().toggleTopView();
  assert.equal(store.getState().camera.pitch, CAMERA_DEFAULTS.pitch);
});

test('focus apunta al edificio, acerca la cámara, detiene la órbita y vuelve a la vista de ciudad', () => {
  const store = createCityStore();
  store.getState().toggle('auto');
  store.getState().setView('hierarchy');
  store.getState().focus('avor');
  const { camera, options, view } = store.getState();
  assert.deepEqual(camera.target, [-6, 8.8 * 0.35, -1]);
  assert.equal(camera.zoom, FOCUS_ZOOM);
  assert.equal(camera.focus, 'avor');
  assert.equal(options.auto, false);
  assert.equal(view, 'city');
});

test('reset restablece la cámara y apaga órbita, vista aérea y enfoque', () => {
  const store = createCityStore();
  store.getState().toggle('auto');
  store.getState().toggleTopView();
  store.getState().focus('bau');
  store.getState().rotateBy(1);
  store.getState().reset();
  const { camera, options } = store.getState();
  assert.deepEqual(camera, { ...CAMERA_DEFAULTS, topView: false, focus: null });
  assert.equal(options.auto, false);
});

test('rotateBy, tiltBy y setOrbit actualizan el giro y limitan la inclinación', () => {
  const store = createCityStore();
  store.getState().rotateBy(0.12);
  assert.equal(store.getState().camera.yaw, CAMERA_DEFAULTS.yaw + 0.12);
  store.getState().tiltBy(10);
  assert.equal(store.getState().camera.pitch, LIMITS.pitchMax);
  store.getState().setOrbit({ yaw: 2, pitch: 0 });
  assert.deepEqual([store.getState().camera.yaw, store.getState().camera.pitch], [2, LIMITS.pitchMin]);
});

test('setZoom limita el valor y stopAuto apaga la órbita', () => {
  const store = createCityStore();
  store.getState().setZoom(0.1);
  assert.equal(store.getState().camera.zoom, LIMITS.zoomMin);
  store.getState().toggle('auto');
  store.getState().stopAuto();
  assert.equal(store.getState().options.auto, false);
});

test('el estado no se muta: cada acción crea objetos nuevos', () => {
  const store = createCityStore();
  const before = store.getState();
  store.getState().toggle('tags');
  store.getState().zoomBy(1.2);
  assert.notEqual(store.getState().options, before.options);
  assert.notEqual(store.getState().camera, before.camera);
  assert.equal(before.options.tags, true);
  assert.equal(before.camera.zoom, 1);
});
