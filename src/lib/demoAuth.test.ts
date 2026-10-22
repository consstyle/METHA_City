import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessDecision, isPublicPath, MIN_PASSWORD_LENGTH, safeEqual } from './demoAuth';

const header = (user: string, password: string, scheme = 'Basic') => `${scheme} ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
const PASSWORD = 'gruezi-demo-2026-ok';
const ENV = { METHACITY_REQUIRE_AUTH: '1', DEMO_USER: 'methabau', DEMO_PASSWORD: PASSWORD };
const req = (authorization: string | null, proto: string | null = 'https') => ({ authorization, forwardedProto: proto });

test('sin exigir acceso (local, e2e) todo pasa', () => {
  assert.equal(accessDecision(req(null, null), {}), 'allow');
});

test('con credenciales correctas pasa; sin cabecera o con credenciales falsas pide acceso', () => {
  assert.equal(accessDecision(req(header('methabau', PASSWORD)), ENV), 'allow');
  assert.equal(accessDecision(req(header('methabau', PASSWORD, 'basic')), ENV), 'allow', 'el esquema no distingue mayúsculas');
  assert.equal(accessDecision(req(null), ENV), 'challenge');
  assert.equal(accessDecision(req(header('methabau', 'falsch')), ENV), 'challenge');
  assert.equal(accessDecision(req(header('admin', PASSWORD)), ENV), 'challenge');
  assert.equal(accessDecision(req('Bearer abc'), ENV), 'challenge');
  assert.equal(accessDecision(req('Basic %%%no-base64'), ENV), 'challenge');
  assert.equal(accessDecision(req(header('methabau', `${PASSWORD}:extra`)), ENV), 'challenge', 'la contraseña es exacta');
});

test('la imagen falla cerrada: exigir acceso sin credenciales válidas no deja pasar a nadie', () => {
  assert.equal(accessDecision(req(header('x', 'y')), { METHACITY_REQUIRE_AUTH: '1' }), 'misconfigured');
  assert.equal(accessDecision(req(null), { ...ENV, DEMO_PASSWORD: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) }), 'misconfigured', `mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
  assert.equal(accessDecision(req(null), { ...ENV, DEMO_USER: '' }), 'misconfigured');
  assert.equal(accessDecision(req(null), { ...ENV, DEMO_USER: 'a:b' }), 'misconfigured', 'el usuario no puede llevar «:»');
});

test('si se definen credenciales se exigen aunque falte la bandera', () => {
  assert.equal(accessDecision(req(null), { DEMO_USER: 'methabau', DEMO_PASSWORD: PASSWORD }), 'challenge');
});

test('detrás del proxy, por HTTP no se aceptan credenciales (irían en claro)', () => {
  assert.equal(accessDecision(req(header('methabau', PASSWORD), 'http'), ENV), 'insecure');
  assert.equal(accessDecision(req(null, 'http'), ENV), 'insecure');
  assert.equal(accessDecision(req(header('methabau', PASSWORD), null), ENV), 'allow', 'sin proxy (prueba local) no hay cabecera');
});

test('solo las rutas públicas exactas se libran del acceso', () => {
  assert.equal(isPublicPath('/api/health'), true);
  assert.equal(isPublicPath('/robots.txt'), true);
  for (const p of ['/api/healthz', '/api/health/x', '/api/health-internal', '/robots.txt.bak', '/', '/leitstand']) {
    assert.equal(isPublicPath(p), false, p);
  }
});

test('safeEqual compara textos iguales y distintos (longitudes incluidas)', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), true);
  assert.equal(safeEqual('Grüezi', 'Grüezi'), true, 'misma forma Unicode (NFC)');
});
