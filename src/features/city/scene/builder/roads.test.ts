import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import type { UnitId } from '@/features/city/model/types';
import { FLOW_PAIRS } from '@/features/city/flow/tsFlow';
import { layoutSites, SITE_PLATFORM } from '@/features/city/model/projects';
import { buildRoadGraph, despike, LANE_OFFSET, routeBetween, routeToSite } from './roads';

const unit = (id: UnitId) => CAMPUS_UNITS.find((u) => u.id === id)!;
const inside = (x: number, z: number, id: UnitId, margin = 0) => {
  const u = unit(id);
  return Math.abs(x - u.position.x) < u.size.w / 2 + margin && Math.abs(z - u.position.z) < u.size.d / 2 + margin;
};

test('la red de calles está conectada: desde cualquier nodo se llega a todos', () => {
  const graph = buildRoadGraph();
  const seen = new Set<number>([0]);
  const todo = [0];
  while (todo.length) for (const [next] of graph.adjacency[todo.pop()!] ?? []) if (!seen.has(next)) { seen.add(next); todo.push(next); }
  assert.equal(seen.size, graph.nodes.length);
  assert.ok(graph.nodes.length > 80);
});

test('hay ruta para cada movimiento del ciclo de TS, de puerta a puerta', () => {
  for (const [from, to] of FLOW_PAIRS) {
    const path = routeBetween(unit(from), unit(to));
    assert.ok(path && path.length >= 3, `${from} → ${to}`);
    const [x0, z0] = path[0]!;
    const [x1, z1] = path.at(-1)!;
    assert.ok(inside(x0, z0, from, 1.6), `${from}: sale de su edificio (${x0.toFixed(1)}, ${z0.toFixed(1)})`);
    assert.ok(inside(x1, z1, to, 1.6), `${to}: llega a su edificio`);
  }
});

test('las rutas no atraviesan otros edificios (también entre puntos)', () => {
  for (const [from, to] of FLOW_PAIRS) {
    const path = routeBetween(unit(from), unit(to))!;
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1]!;
      const [bx, bz] = path[i]!;
      for (let s = 0; s <= 10; s++) {
        const x = ax + ((bx - ax) * s) / 10;
        const z = az + ((bz - az) * s) / 10;
        for (const other of CAMPUS_UNITS) {
          if (other.id === from || other.id === to) continue;
          assert.ok(!inside(x, z, other.id, 0.2), `${from} → ${to} pasa por ${other.id} en (${x.toFixed(1)}, ${z.toFixed(1)})`);
        }
      }
    }
  }
});

test('sin medias vueltas por la calle: ningún giro interior de más de 120°', () => {
  for (const [from, to] of FLOW_PAIRS) {
    const path = routeBetween(unit(from), unit(to))!;
    for (let i = 3; i < path.length - 3; i++) {
      const [ax, az] = path[i - 1]!;
      const [bx, bz] = path[i]!;
      const [cx, cz] = path[i + 1]!;
      const u = [bx - ax, bz - az];
      const v = [cx - bx, cz - bz];
      const lu = Math.hypot(u[0]!, u[1]!);
      const lv = Math.hypot(v[0]!, v[1]!);
      if (lu < 1e-6 || lv < 1e-6) continue;
      const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (lu * lv);
      assert.ok(cos > Math.cos((120 * Math.PI) / 180), `${from} → ${to}: giro de ${((Math.acos(cos) * 180) / Math.PI).toFixed(0)}° en el punto ${i}`);
    }
  }
});

test('ida y vuelta circulan por carriles distintos (circulación por la derecha)', () => {
  const go = routeBetween(unit('avor'), unit('schlosserei'))!;
  const back = routeBetween(unit('schlosserei'), unit('avor'))!;
  const mid = go[Math.floor(go.length / 2)]!;
  const nearest = Math.min(...back.map(([x, z]) => Math.hypot(x - mid[0], z - mid[1])));
  assert.ok(nearest > LANE_OFFSET, `los carriles se separan (${nearest.toFixed(2)})`);
});

test('despike quita las medias vueltas y deja intactas las curvas normales', () => {
  assert.deepEqual(despike([[0, 0], [2, 0], [1.6, 0.1], [1.6, 3]]), [[0, 0], [1.6, 0.1], [1.6, 3]]);
  assert.deepEqual(despike([[0, 0], [1, 0], [2, 1], [2, 3]]), [[0, 0], [1, 0], [2, 1], [2, 3]]);
  assert.deepEqual(despike([[0, 0], [0, 0], [1, 0]]), [[0, 0], [1, 0]], 'puntos repetidos');
});

test('las rutas se reutilizan (caché) y una unidad consigo misma no tiene ruta', () => {
  assert.equal(routeBetween(unit('avor'), unit('werkhof')), routeBetween(unit('avor'), unit('werkhof')));
  assert.equal(routeBetween(unit('avor'), unit('avor')), null);
});

const SITES = layoutSites([
  { projektId: 'a', projektnummer: 'DEV-001', projektname: 'A' },
  { projektId: 'b', projektnummer: 'DEV-002', projektname: 'B' },
  { projektId: 'c', projektnummer: 'DEV-003', projektname: 'C' },
  { projektId: 'd', projektnummer: 'DEV-004', projektname: 'D' },
]);

test('hay ruta de AVOR a cada obra: por las calles y la carretera de la obra hasta su plataforma', () => {
  for (const site of SITES) {
    const path = routeToSite(unit('avor'), site);
    assert.ok(path && path.length >= 4, site.id);
    const [x0, z0] = path[0]!;
    assert.ok(inside(x0, z0, 'avor', 1.6), 'sale de AVOR');
    const [x1, z1] = path.at(-1)!;
    const out = Math.hypot(x1 - site.position.x, z1 - site.position.z);
    assert.ok(out < SITE_PLATFORM.d / 2, `${site.id}: termina dentro de la plataforma (${out.toFixed(2)})`);
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1]!;
      const [bx, bz] = path[i]!;
      for (let s = 0; s <= 10; s++) {
        const [x, z] = [ax + ((bx - ax) * s) / 10, az + ((bz - az) * s) / 10];
        for (const other of CAMPUS_UNITS) if (other.id !== 'avor') assert.ok(!inside(x, z, other.id, 0.2), `${site.id} pasa por ${other.id}`);
      }
    }
  }
  const site = SITES[0]!;
  assert.equal(routeToSite(unit('avor'), site), routeToSite(unit('avor'), site), 'caché');
});
