import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABTEILUNGEN, abteilungName } from './abteilungen';
import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from './campus';
import { ABTEILUNG_IDS } from './types';

/** Valores del array `departments` de preview/preview.html. */
const PREVIEW: Record<string, { x: number; z: number; w: number; d: number; h: number; type: string; parent: string | null; level: number }> = {
  avor: { x: -6, z: -1, h: 8.8, w: 4.7, d: 3.5, type: 'tower', parent: null, level: 0 },
  einkauf: { x: -15, z: -7, h: 4, w: 3.5, d: 3.4, type: 'office', parent: 'avor', level: 1 },
  schlosserei: { x: -15, z: 3.7, h: 2.8, w: 5.8, d: 4.1, type: 'factory', parent: 'avor', level: 1 },
  blech: { x: -6.6, z: 9, h: 2.3, w: 5.7, d: 3.8, type: 'sawtooth', parent: 'avor', level: 1 },
  werkhof: { x: -3, z: -10, h: 2.4, w: 4.5, d: 3.8, type: 'logistics', parent: 'avor', level: 1 },
  projektleitung: { x: 8.5, z: -8, h: 6.9, w: 3.8, d: 3.5, type: 'terrace', parent: null, level: 0 },
  bauleitung: { x: 13, z: 1, h: 4.5, w: 4, d: 3.1, type: 'office', parent: 'projektleitung', level: 1 },
  bau: { x: 9.3, z: 9.5, h: 2.8, w: 4.8, d: 4.1, type: 'site', parent: 'bauleitung', level: 2 },
};

test('el campus tiene las 8 unidades del HTML con códigos 01–08', () => {
  assert.deepEqual(CAMPUS_UNITS.map((u) => u.code), ['01', '02', '03', '04', '05', '06', '07', '08']);
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

test('los cuatro departamentos sin edificio son subunidades (decisión D2)', () => {
  const where = (dept: string) => CAMPUS_UNITS.find((u) => u.subunits.some((s) => s.methadesk.includes(dept as never)))?.id;
  assert.equal(where('planer'), 'projektleitung');
  assert.equal(where('montage'), 'bau');
  assert.equal(where('subunternehmer'), 'bau');
  assert.equal(where('unternehmer'), 'einkauf');
});

test('cada unidad tiene su agente y el orquestador no tiene edificio (decisión D1)', () => {
  assert.ok(CAMPUS_UNITS.every((u) => u.agent === u.id));
  assert.equal(ORCHESTRATOR_AGENT, 'chief');
  assert.ok(!CAMPUS_UNITS.some((u) => (u.id as string) === ORCHESTRATOR_AGENT));
});

test('las definiciones del campus son inmutables', () => {
  assert.ok(Object.isFrozen(CAMPUS_UNITS));
  assert.ok(Object.isFrozen(CAMPUS_UNITS[0]));
  assert.ok(Object.isFrozen(CAMPUS_UNITS[1]?.subunits[0]));
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
