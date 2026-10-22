import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, wobblyEllipsePoint } from './island';
import { layoutSites, parseSiteId, projectAgentIds, projectSiteId, projectTeamIds, SITE_PLATFORM, type ProjectRef } from './projects';

const refs = (n: number): ProjectRef[] =>
  Array.from({ length: n }, (_, i) => ({ projektId: `id-${i}`, projektnummer: `DEV-${String(i + 1).padStart(3, '0')}`, projektname: `Projekt ${i + 1}` }));

const radius = (x: number, z: number) => Math.hypot(x, z);

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

test('la carretera sale del anillo vial y llega al borde de su plataforma', () => {
  for (const s of layoutSites(refs(4))) {
    const [start, end] = s.road;
    assert.ok(radius(start.x, start.z) < radius(end.x, end.z), 'va hacia fuera');
    const toPlatform = radius(end.x - s.position.x, end.z - s.position.z);
    assert.ok(toPlatform <= SITE_PLATFORM.d / 2 + 0.6, `${s.projektnummer}: termina en la plataforma (${toPlatform.toFixed(2)})`);
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
