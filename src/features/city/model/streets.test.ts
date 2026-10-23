import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from './campus';
import { insideIsland } from './island';
import { clearOfRoads, hiddenByRoads, HUB_PLAZA, LANDSCAPE_OBSTACLES, PARKED, PLAZAS, TREES } from './landscape';
import {
  angleGap, bearing, CAMPUS_STREETS, distanceToSegment, distanceToUnit, doorToward, HUB, hubUnit, ROAD_HALF, streetClearance,
} from './streets';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('hay una calle recta de AVOR a cada edificio, de puerta a puerta', () => {
  assert.deepEqual(CAMPUS_STREETS.map((s) => s.id), CAMPUS_UNITS.filter((u) => u.id !== HUB).map((u) => u.id));
  const hub = hubUnit();
  for (const s of CAMPUS_STREETS) {
    const unit = CAMPUS_UNITS.find((u) => u.id === s.id)!;
    assert.ok(near(distanceToUnit(s.from, hub), 0, 1e-6), `${s.id}: sale del pavimento de AVOR`);
    assert.ok(near(distanceToUnit(s.to, unit), 0, 1e-6), `${s.id}: llega al pavimento del edificio`);
    assert.ok(streetClearance(s.from, s.to, [HUB, s.id]) >= ROAD_HALF, `${s.id}: no atraviesa otros edificios`);
  }
});

test('las calles del campus salen de AVOR en direcciones bien separadas', () => {
  for (const a of CAMPUS_STREETS) for (const b of CAMPUS_STREETS) {
    if (a.id < b.id) assert.ok(angleGap(bearing(a), bearing(b)) > (15 * Math.PI) / 180, `${a.id} y ${b.id}`);
  }
});

test('ningún jardín, árbol, plaza ni coche aparcado queda en medio de una calle', () => {
  for (const s of CAMPUS_STREETS) {
    const unit = CAMPUS_UNITS.find((u) => u.id === s.id)!;
    // La calle llega a su edificio cruzando la plaza de ese edificio (si la tiene).
    const own = (o: { x: number; z: number }) => o.x === unit.position.x && o.z === unit.position.z;
    for (const o of LANDSCAPE_OBSTACLES.filter((x) => !own(x))) assert.ok(clearOfRoads(o, [[s.from, s.to]]), `${o.kind} en (${o.x}, ${o.z}) sobre la calle de ${s.id}`);
  }
  for (const [x, z] of PLAZAS.filter((_, i) => i !== HUB_PLAZA)) assert.ok(insideIsland({ x, z }, 2));
  for (const v of PARKED) assert.ok(insideIsland(v, 1), `coche en (${v.x}, ${v.z}) dentro de la isla`);
});

test('ningún elemento del paisaje queda dentro de un edificio (los coches pueden estar en su pavimento)', () => {
  const body = (p: { x: number; z: number }, u: (typeof CAMPUS_UNITS)[number]) => Math.hypot(
    Math.max(Math.abs(p.x - u.position.x) - u.size.w / 2, 0), Math.max(Math.abs(p.z - u.position.z) - u.size.d / 2, 0));
  for (const o of LANDSCAPE_OBSTACLES.filter((x) => x.kind !== 'plaza')) {
    const room = o.kind === 'parking' ? 0.3 : o.r;
    assert.ok(CAMPUS_UNITS.every((u) => (o.kind === 'parking' ? body(o, u) : distanceToUnit(o, u)) >= Math.min(room, 0.5)), `${o.kind} en (${o.x}, ${o.z})`);
  }
});

test('geometría: puerta hacia un punto, distancia a un segmento y diferencia de ángulos', () => {
  const box = { position: { x: 0, z: 0 }, size: { w: 4, d: 2, h: 1 } };
  assert.deepEqual(doorToward(box, { x: 10, z: 0 }), { x: 2.5, z: 0 });
  assert.deepEqual(doorToward(box, { x: 0, z: -10 }), { x: 0, z: -1.5 });
  assert.equal(distanceToSegment({ x: 0, z: 3 }, { x: -1, z: 0 }, { x: 1, z: 0 }), 3);
  assert.equal(distanceToSegment({ x: 5, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 0 }), 4);
  assert.ok(near(angleGap(Math.PI - 0.1, -Math.PI + 0.1), 0.2));
  assert.equal(distanceToUnit({ x: 0, z: 0 }, box), 0);
});

test('una calle de obra oculta justo las plantas y coches que pisa, nunca una plaza', () => {
  const tree = TREES.findIndex(([x, z]) => x === 6 && z === -2);
  const road = [{ x: 0, z: -2 }, { x: 12, z: -2 }];
  const hidden = hiddenByRoads([road]);
  assert.equal(hidden('tree', tree), true);
  assert.equal(hidden('tree', TREES.findIndex(([x, z]) => x === 18 && z === -7)), false);
  const plaza = hiddenByRoads([[{ x: 0, z: -8 }, { x: 20, z: -8 }]]);
  assert.equal(plaza('plaza', 1), false, 'las plazas no se quitan');
  assert.equal(hiddenByRoads([])('tree', tree), false);
});
