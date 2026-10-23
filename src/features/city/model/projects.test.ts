import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneExtent } from './viewFit';
import { insideIsland, ISLAND, wobblyEllipsePoint } from './island';
import { clearOfRoads, LANDSCAPE_OBSTACLES } from './landscape';
import { PAVILION_LOTS } from './specialists';
import { SITE_RADIUS } from './siteLayout';
import {
  angleGap, bearing, CAMPUS_STREETS, distanceToSegment, distanceToUnit, HUB, hubUnit, ROAD_HALF, roadSegments, samplesAlong, streetClearance,
} from './streets';
import { layoutSites, parseSiteId, projectAgentIds, projectSiteId, projectTeamIds, SITE_PLATFORM, type ProjectRef, type ProjectSite } from './projects';

const refs = (n: number): ProjectRef[] =>
  Array.from({ length: n }, (_, i) => ({ projektId: `id-${i}`, projektnummer: `DEV-${String(i + 1).padStart(3, '0')}`, projektname: `Projekt ${i + 1}` }));

const radius = (x: number, z: number) => Math.hypot(x, z);

/** true si el punto cae sobre la plataforma de la obra (rectángulo girado, con la media calzada). */
function onPlatform(q: { x: number; z: number }, s: ProjectSite): boolean {
  const front = s.road.at(-1)!;
  const out = { x: (s.position.x - front.x) / (SITE_PLATFORM.d / 2), z: (s.position.z - front.z) / (SITE_PLATFORM.d / 2) };
  const rel = { x: q.x - s.position.x, z: q.z - s.position.z };
  return Math.abs(rel.x * out.x + rel.z * out.z) < SITE_PLATFORM.d / 2 + ROAD_HALF
    && Math.abs(-rel.x * out.z + rel.z * out.x) < SITE_PLATFORM.w / 2 + ROAD_HALF;
}

test('cada proyecto activo tiene su obra fuera de la isla, ordenadas por número de proyecto', () => {
  const sites = layoutSites([...refs(3)].reverse());
  assert.deepEqual(sites.map((s) => s.projektnummer), ['DEV-001', 'DEV-002', 'DEV-003']);
  for (const s of sites) {
    const a = Math.atan2(s.position.z / ISLAND.rz, s.position.x / ISLAND.rx);
    const edge = wobblyEllipsePoint(ISLAND.rx, ISLAND.rz, a);
    assert.ok(radius(s.position.x, s.position.z) > radius(edge.x, edge.z) + SITE_PLATFORM.w / 2, `${s.projektnummer} queda fuera de la isla`);
  }
});

test('las plataformas no se solapan, aunque haya muchos proyectos (el anillo de obras se aleja)', () => {
  for (const n of [1, 3, 8, 20]) {
    const sites = layoutSites(refs(n));
    assert.equal(sites.length, n);
    for (const a of sites) for (const b of sites) {
      if (a.id >= b.id) continue;
      assert.ok(radius(a.position.x - b.position.x, a.position.z - b.position.z) >= SITE_PLATFORM.w + 1, `${n}: ${a.projektnummer} y ${b.projektnummer} se solapan`);
    }
  }
});

test('la calle de cada obra sale de la puerta de AVOR y llega al frente de su plataforma', () => {
  for (const s of layoutSites(refs(4))) {
    const start = s.road[0]!;
    const end = s.road.at(-1)!;
    assert.ok(distanceToUnit(start, hubUnit()) < 1e-6, `${s.projektnummer}: sale de AVOR`);
    const toCenter = radius(end.x - s.position.x, end.z - s.position.z);
    assert.ok(Math.abs(toCenter - SITE_PLATFORM.d / 2) < 1e-6, `${s.projektnummer}: termina en el frente de la plataforma`);
  }
});

test('con los 3 proyectos del simulador: calles rectas y limpias, y la ciudad se ve grande', () => {
  const sites = layoutSites(refs(3));
  assert.ok(sites.every((s) => s.road.length === 2), 'una calle recta por obra');
  for (const s of sites) {
    const [a, b] = [s.road[0]!, s.road[1]!];
    assert.ok(streetClearance(a, b, [HUB]) >= ROAD_HALF, `${s.projektnummer}: no pisa edificios`);
    assert.ok(LANDSCAPE_OBSTACLES.every((o) => clearOfRoads(o, [[a, b]])), `${s.projektnummer}: no pisa jardines, árboles ni coches`);
    assert.ok(PAVILION_LOTS.every((l) => distanceToSegment(l, a, b) > ROAD_HALF + 1), `${s.projektnummer}: no pisa solares`);
    assert.ok(CAMPUS_STREETS.every((c) => angleGap(bearing(c), bearing({ from: a, to: b })) > (10 * Math.PI) / 180), 'separada de las calles del campus');
  }
  assert.ok(sceneExtent(sites.map((s) => s.position)) < 1.4, 'el encuadre apenas se abre');
  assert.deepEqual(layoutSites(refs(3)), sites, 'determinista');
});

test('con muchos proyectos ninguna obra se solapa, todas tienen calle desde AVOR y se calcula rápido', () => {
  const t0 = Date.now();
  const sites = layoutSites(refs(30));
  assert.ok(Date.now() - t0 < 3000, 'sin bloquear la página');
  assert.equal(sites.length, 30);
  for (const s of sites) {
    assert.ok(distanceToUnit(s.road[0]!, hubUnit()) < 1e-6);
    assert.ok(!insideIsland(s.position), `${s.projektnummer} fuera de la isla`);
    // Las que cuelgan de otra calle: el ramal va por fuera de la isla.
    if (s.road.length === 3) assert.ok(!insideIsland(s.road[1]!), `${s.projektnummer}: el ramal empieza fuera de la isla`);
  }
  assert.ok(sites.some((s) => s.road.length > 2), 'cuando no queda dirección libre, siguen la calle de otra obra');
  for (const a of sites) {
    for (const b of sites) if (a !== b) assert.ok(radius(a.position.x - b.position.x, a.position.z - b.position.z) >= 2 * SITE_RADIUS + 1, 'sin solapes');
    // Tramo propio (en las que siguen otra calle, desde el empalme): por fuera de la isla y sin pisar otras obras.
    const own = a.road.length > 2 ? a.road.slice(1) : a.road;
    for (const [p, q] of roadSegments(own)) {
      for (const pt of samplesAlong(p, q, 0.5)) {
        if (a.road.length > 2) assert.ok(!insideIsland(pt, -ROAD_HALF), `${a.projektnummer}: su calle pisa la isla`);
        for (const o of sites) if (o !== a) assert.ok(!onPlatform(pt, o), `${a.projektnummer}: su calle pasa por ${o.projektnummer}`);
      }
    }
  }
});

test('ids de obra y de sus agentes, y su lectura inversa', () => {
  assert.equal(projectSiteId('abc'), 'projekt:abc');
  assert.equal(parseSiteId('projekt:abc'), 'abc');
  assert.equal(parseSiteId('avor'), null);
  assert.deepEqual(projectAgentIds('DEV-001'), { pl: 'pl-dev-001', bl: 'bl-dev-001' });
  assert.deepEqual(projectAgentIds('P 24/07 Ä'), { pl: 'pl-p-24-07-a', bl: 'bl-p-24-07-a' });
  const [site] = layoutSites(refs(1));
  assert.deepEqual(site!.agents, { pl: 'pl-dev-001', bl: 'bl-dev-001' });
});

test('los ids de agente son únicos aunque dos números den el mismo slug, y no pasan de 80 caracteres', () => {
  const clash: ProjectRef[] = [
    { projektId: 'b', projektnummer: '2024-01', projektname: 'B' },
    { projektId: 'a', projektnummer: '2024/01', projektname: 'A' },
    { projektId: 'c', projektnummer: 'Δ', projektname: 'C' },
    { projektId: 'd', projektnummer: '漢', projektname: 'D' },
  ];
  const ids = projectTeamIds(clash);
  const all = [...ids.values()].map((t) => t.pl);
  assert.equal(new Set(all).size, 4, all.join(', '));
  assert.deepEqual(ids.get('b'), { pl: 'pl-2024-01', bl: 'bl-2024-01' }, '«-» va antes que «/»');
  assert.deepEqual(ids.get('a'), { pl: 'pl-2024-01-2', bl: 'bl-2024-01-2' });
  assert.deepEqual(layoutSites(clash).map((s) => s.agents.pl).sort(), [...all].sort(), 'las obras usan los mismos ids');
  assert.ok(projectAgentIds('X'.repeat(200)).pl.length <= 80);
});

test('sin proyectos no hay obras', () => {
  assert.deepEqual(layoutSites([]), []);
});
