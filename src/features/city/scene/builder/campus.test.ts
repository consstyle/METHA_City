import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations, labelAnchorHeight } from '@/features/city/model/hierarchy';
import { layoutSites } from '@/features/city/model/projects';
import { buildCampus } from './campus';
import { applyDaylight, createMaterials } from './materials';

before(() => {
  // Los carteles usan un <canvas>: en Node basta un sustituto sin contexto 2D.
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  };
});

const build = () => buildCampus(CAMPUS_UNITS, deriveRelations(CAMPUS_UNITS));

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

test('cada unidad del campus tiene geometría seleccionable con su id', () => {
  const campus = build();
  const ids = new Set(meshes(campus.pickables).map((m) => m.userData.id));
  assert.deepEqual([...ids].sort(), CAMPUS_UNITS.map((u) => u.id).sort());
  campus.dispose();
});

test('hay un anillo de selección por unidad, todos ocultos al principio', () => {
  const campus = build();
  assert.equal(campus.rings.size, CAMPUS_UNITS.length);
  assert.ok([...campus.rings.values()].every((r) => r.visible === false));
  campus.dispose();
});

test('las rutas son las 5 dependencias de AVOR con 2 puntos; una coordinación lleva 4', () => {
  const campus = build();
  const { animations } = campus.routes;
  assert.equal(animations.length, 5);
  assert.ok(animations.every((a) => a.relation.kind === 'hierarchy' && a.dots.length === 2));
  campus.dispose();
  const linked = buildCampus(CAMPUS_UNITS, deriveRelations(CAMPUS_UNITS, [{ from: 'einkauf', to: 'werkhof' }]));
  assert.deepEqual(
    linked.routes.animations.filter((a) => a.relation.kind === 'coordination').map((a) => a.dots.length),
    [4],
  );
  linked.dispose();
});

const SITES = layoutSites([
  { projektId: 'a', projektnummer: 'DEV-001', projektname: 'A' },
  { projektId: 'b', projektnummer: 'DEV-002', projektname: 'B' },
  { projektId: 'c', projektnummer: 'DEV-003', projektname: 'C' },
]);

test('cada obra se puede seleccionar, tiene su anillo y su etiqueta, y va instanciada', () => {
  const plain = buildCampus(CAMPUS_UNITS, deriveRelations(CAMPUS_UNITS), SITES.slice(0, 1));
  const campus = buildCampus(CAMPUS_UNITS, deriveRelations(CAMPUS_UNITS), SITES);
  const ids = new Set(meshes(campus.pickables).map((m) => m.userData.id));
  for (const s of SITES) {
    assert.ok(ids.has(s.id), `${s.id} seleccionable`);
    assert.equal(campus.rings.get(s.id)?.visible, false);
    assert.deepEqual([campus.labelAnchors.get(s.id)?.x, campus.labelAnchors.get(s.id)?.z], [s.building.x, s.building.z]);
  }
  // Cada obra más: un volumen invisible de selección y un anillo; todo lo demás va instanciado.
  assert.equal(meshes(campus.root).length - meshes(plain.root).length, (SITES.length - 1) * 2);
  assert.ok(meshes(plain.root).length - meshes(build().root).length <= 8, 'pocas mallas nuevas por tener obras');
  plain.dispose();
  campus.dispose();
});

test('el tráfico son 3 vehículos que no proyectan sombra (las sombras son estáticas)', () => {
  const campus = build();
  assert.equal(campus.cars.length, 3);
  assert.ok(campus.cars.every((car) => meshes(car).every((m) => !m.castShadow)));
  campus.dispose();
});

test('los anclajes de etiqueta coinciden con las alturas de preview.html', () => {
  const campus = build();
  for (const u of CAMPUS_UNITS) {
    const anchor = campus.labelAnchors.get(u.id);
    assert.deepEqual([anchor?.x, anchor?.y, anchor?.z], [u.position.x, labelAnchorHeight(u), u.position.z]);
  }
  campus.dispose();
});

test('los elementos repetidos están instanciados: pocas mallas para todo el campus', () => {
  const campus = build();
  const all = meshes(campus.root);
  const instanced = all.filter((m) => m instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
  const instances = instanced.reduce((s, m) => s + m.count, 0);
  assert.ok(all.length <= 160, `demasiadas mallas: ${all.length}`);
  assert.ok(instances > 1_500, `se esperaban miles de instancias, hay ${instances}`);
  campus.dispose();
});

test('la construcción es determinista (misma semilla que preview.html)', () => {
  const count = () => {
    const campus = build();
    const n = meshes(campus.root)
      .filter((m): m is THREE.InstancedMesh => m instanceof THREE.InstancedMesh)
      .map((m) => m.count)
      .join(',');
    campus.dispose();
    return n;
  };
  assert.equal(count(), count());
});

test('Tageslicht baja el brillo de ventanas y naranja; Abendlicht lo recupera', () => {
  const m = createMaterials();
  applyDaylight(m, true);
  assert.deepEqual([m.window.emissiveIntensity, m.orange.emissiveIntensity], [0.4, 0.7]);
  applyDaylight(m, false);
  assert.deepEqual([m.window.emissiveIntensity, m.orange.emissiveIntensity], [1.2, 1.2]);
});

test('dispose libera la geometría sin errores y se puede repetir la construcción', () => {
  const campus = build();
  assert.doesNotThrow(() => campus.dispose());
  assert.doesNotThrow(() => build().dispose());
});
