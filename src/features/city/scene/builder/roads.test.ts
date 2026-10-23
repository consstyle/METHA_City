import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { layoutSites, SITE_PLATFORM } from '@/features/city/model/projects';
import { CAMPUS_STREETS, distanceToSegment } from '@/features/city/model/streets';
import type { UnitId } from '@/features/city/model/types';
import { FLOW_PAIRS } from '@/features/city/flow/tsFlow';
import { LANE_OFFSET, lanePath, routeBetween, routeToSite } from './roads';

const unit = (id: UnitId) => CAMPUS_UNITS.find((u) => u.id === id)!;
const inside = (x: number, z: number, id: UnitId, margin = 0) => {
  const u = unit(id);
  return Math.abs(x - u.position.x) < u.size.w / 2 + margin && Math.abs(z - u.position.z) < u.size.d / 2 + margin;
};

test('cada movimiento del ciclo de TS es una sola calle recta, de puerta a puerta', () => {
  for (const [from, to] of FLOW_PAIRS) {
    const path = routeBetween(unit(from), unit(to));
    assert.ok(path && path.length === 2, `${from} → ${to}`);
    const [x0, z0] = path[0]!;
    const [x1, z1] = path[1]!;
    assert.ok(inside(x0, z0, from, 1.6), `${from}: sale de su edificio (${x0.toFixed(1)}, ${z0.toFixed(1)})`);
    assert.ok(inside(x1, z1, to, 1.6), `${to}: llega a su edificio`);
    // Va por su calle: a un carril del eje.
    const street = CAMPUS_STREETS.find((s) => s.id === (from === 'avor' ? to : from))!;
    for (const [x, z] of path) assert.ok(Math.abs(distanceToSegment({ x, z }, street.from, street.to) - LANE_OFFSET) < 1e-6);
  }
});

test('las rutas no atraviesan otros edificios', () => {
  for (const [from, to] of FLOW_PAIRS) {
    const path = routeBetween(unit(from), unit(to))!;
    const [ax, az] = path[0]!;
    const [bx, bz] = path[1]!;
    for (let s = 0; s <= 40; s++) {
      const x = ax + ((bx - ax) * s) / 40;
      const z = az + ((bz - az) * s) / 40;
      for (const other of CAMPUS_UNITS) {
        if (other.id === from || other.id === to) continue;
        assert.ok(!inside(x, z, other.id, 0.2), `${from} → ${to} pasa por ${other.id}`);
      }
    }
  }
});

test('ida y vuelta circulan por carriles distintos (circulación por la derecha)', () => {
  const go = routeBetween(unit('avor'), unit('schlosserei'))!;
  const back = routeBetween(unit('schlosserei'), unit('avor'))!;
  const gap = Math.hypot(go[0]![0] - back[1]![0], go[0]![1] - back[1]![1]);
  assert.ok(Math.abs(gap - 2 * LANE_OFFSET) < 1e-6, `los carriles se separan (${gap.toFixed(2)})`);
});

test('todas las calles salen de AVOR: entre dos edificios cualesquiera no hay ruta directa', () => {
  assert.equal(routeBetween(unit('schlosserei'), unit('blech')), null);
  assert.equal(routeBetween(unit('avor'), unit('avor')), null);
});

test('de AVOR a cada obra por su calle, hasta dentro de la plataforma; desde otro edificio, no', () => {
  for (const site of layoutSites([1, 2, 3, 4].map((i) => ({ projektId: `${i}`, projektnummer: `DEV-00${i}`, projektname: `P${i}` })))) {
    const path = routeToSite(unit('avor'), site);
    assert.ok(path && path.length === site.road.length + 1, site.id);
    const [x0, z0] = path[0]!;
    assert.ok(inside(x0, z0, 'avor', 1.6), 'sale de AVOR');
    const [x1, z1] = path.at(-1)!;
    assert.ok(Math.hypot(x1 - site.position.x, z1 - site.position.z) < SITE_PLATFORM.d / 2, `${site.id}: termina dentro de la plataforma`);
    assert.equal(routeToSite(unit('werkhof'), site), null);
  }
});

test('el carril de una ruta con esquina se desplaza con inglete y sin dispararse', () => {
  const lane = lanePath([[0, 0], [10, 0], [10, 10]], 1);
  assert.deepEqual(lane[0], [0, 1]);
  assert.ok(Math.hypot(lane[1]![0] - 10, lane[1]![1]) <= 2 + 1e-9);
  assert.deepEqual(lanePath([[0, 0]], 1), [[0, 0]]);
});
