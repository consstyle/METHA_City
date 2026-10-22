import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABTEILUNGEN, abteilungName } from './abteilungen';
import { CAMPUS_UNITS, ORCHESTRATOR_AGENT, PROJECT_DEPARTMENTS } from './campus';
import { ABTEILUNG_IDS } from './types';

/**
 * Valores del array `departments` de preview/preview.html. F5c (D25): el Planer ocupa el edificio
 * de la antigua Projektleitung y depende de AVOR; Projektleitung, Bauleitung y Bau pasan a las obras.
 */
const PREVIEW: Record<string, { x: number; z: number; w: number; d: number; h: number; type: string; parent: string | null; level: number }> = {
  avor: { x: -6, z: -1, h: 8.8, w: 4.7, d: 3.5, type: 'tower', parent: null, level: 0 },
  planer: { x: 8.5, z: -8, h: 6.9, w: 3.8, d: 3.5, type: 'terrace', parent: 'avor', level: 1 },
  einkauf: { x: -15, z: -7, h: 4, w: 3.5, d: 3.4, type: 'office', parent: 'avor', level: 1 },
  schlosserei: { x: -15, z: 3.7, h: 2.8, w: 5.8, d: 4.1, type: 'factory', parent: 'avor', level: 1 },
  blech: { x: -6.6, z: 9, h: 2.3, w: 5.7, d: 3.8, type: 'sawtooth', parent: 'avor', level: 1 },
  werkhof: { x: -3, z: -10, h: 2.4, w: 4.5, d: 3.8, type: 'logistics', parent: 'avor', level: 1 },
};

test('el campus tiene las 6 unidades con códigos 01–06 (la obra es de los proyectos, F5c)', () => {
  assert.deepEqual(CAMPUS_UNITS.map((u) => u.code), ['01', '02', '03', '04', '05', '06']);
  assert.deepEqual(CAMPUS_UNITS.map((u) => u.id).sort(), Object.keys(PREVIEW).sort());
});

for (const unit of CAMPUS_UNITS) {
  test(`${unit.id}: posición, tamaño, arquetipo y jerarquía coinciden con preview.html`, () => {
    const p = PREVIEW[unit.id];
    assert.ok(p, `falta ${unit.id} en la referencia`);
    assert.deepEqual(unit.position, { x: p.x, z: p.z });
    assert.deepEqual(unit.size, { w: p.w, d: p.d, h: p.h });
    assert.equal(unit.archetype, p.type);
    assert.equal(unit.parent, p.parent);
    assert.equal(unit.level, p.level);
  });
}

test('cada departamento de MethaDesk está en un edificio del campus o es de obra, nunca en dos sitios', () => {
  const owners = (dept: string) => CAMPUS_UNITS.filter((u) => [...u.methadesk, ...u.subunits.flatMap((s) => s.methadesk)].includes(dept as never));
  assert.equal(owners('planer')[0]?.id, 'planer');
  assert.equal(owners('unternehmer')[0]?.id, 'einkauf');
  for (const dept of ABTEILUNG_IDS) {
    const project = PROJECT_DEPARTMENTS.includes(dept);
    assert.equal(owners(dept).length, project ? 0 : 1, dept);
  }
  assert.deepEqual([...PROJECT_DEPARTMENTS].sort(), ['bau', 'bauleiter', 'montage', 'projektleiter', 'subunternehmer']);
});

test('cada unidad tiene su agente y el orquestador no tiene edificio (decisión D1)', () => {
  assert.ok(CAMPUS_UNITS.every((u) => u.agent === u.id));
  assert.equal(ORCHESTRATOR_AGENT, 'chief');
  assert.ok(!CAMPUS_UNITS.some((u) => (u.id as string) === ORCHESTRATOR_AGENT));
});

test('las definiciones del campus son inmutables', () => {
  assert.ok(Object.isFrozen(CAMPUS_UNITS));
  assert.ok(Object.isFrozen(CAMPUS_UNITS[0]));
  assert.ok(Object.isFrozen(CAMPUS_UNITS.find((u) => u.id === 'einkauf')?.subunits[0]));
  assert.throws(() => {
    (CAMPUS_UNITS as unknown as { push: (x: unknown) => void }).push({});
  });
});

test('el catálogo de departamentos coincide con ABTEILUNGEN_CONFIG y con ABTEILUNG_IDS', () => {
  assert.deepEqual(ABTEILUNGEN.map((a) => a.id), [...ABTEILUNG_IDS]);
});

test('abteilungName devuelve el nombre de MethaDesk o el id si no lo conoce', () => {
  assert.equal(abteilungName('bauleiter'), 'Bauleitung');
  assert.equal(abteilungName('blech'), 'Blechabteilung');
  assert.equal(abteilungName('desconocido' as never), 'desconocido');
});
