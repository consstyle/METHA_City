import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from './campus';
import {
  ancestorsOf,
  childrenOf,
  deriveRelations,
  labelAnchorHeight,
  unitById,
  unitsByDistrict,
  validateCampus,
} from './hierarchy';
import type { UnitDef } from './types';

test('el campus definido no tiene problemas de estructura', () => {
  assert.deepEqual(validateCampus(CAMPUS_UNITS), []);
});

test('childrenOf devuelve los hijos ordenados por código', () => {
  assert.deepEqual(
    childrenOf(CAMPUS_UNITS, 'avor').map((u) => u.id),
    ['einkauf', 'schlosserei', 'blech', 'werkhof'],
  );
  assert.deepEqual(childrenOf(CAMPUS_UNITS, 'projektleitung').map((u) => u.id), ['bauleitung']);
  assert.deepEqual(childrenOf(CAMPUS_UNITS, 'bau'), []);
});

test('ancestorsOf recorre la cadena hasta la raíz del distrito', () => {
  assert.deepEqual(ancestorsOf(CAMPUS_UNITS, 'bau').map((u) => u.id), ['bauleitung', 'projektleitung']);
  assert.deepEqual(ancestorsOf(CAMPUS_UNITS, 'avor'), []);
});

test('unitsByDistrict separa los dos distritos en orden de código', () => {
  assert.deepEqual(
    unitsByDistrict(CAMPUS_UNITS, 'industrial').map((u) => u.code),
    ['01', '02', '03', '04', '05'],
  );
  assert.deepEqual(unitsByDistrict(CAMPUS_UNITS, 'project').map((u) => u.code), ['06', '07', '08']);
});

test('unitById encuentra una unidad y devuelve undefined si no existe', () => {
  assert.equal(unitById(CAMPUS_UNITS, 'werkhof')?.name, 'Werkhof');
  assert.equal(unitById(CAMPUS_UNITS, 'no-existe'), undefined);
});

test('deriveRelations crea una relación jerárquica por hijo y la coordinación AVOR ↔ Bauleitung', () => {
  const relations = deriveRelations(CAMPUS_UNITS);
  const hierarchy = relations.filter((r) => r.kind === 'hierarchy');
  assert.equal(hierarchy.length, 6);
  assert.equal(relations.length, 7);
  assert.ok(hierarchy.some((r) => r.from === 'bauleitung' && r.to === 'bau'));
  assert.deepEqual(
    relations.filter((r) => r.kind === 'coordination'),
    [{ from: 'avor', to: 'bauleitung', kind: 'coordination' }],
  );
});

test('labelAnchorHeight reproduce las alturas de etiqueta del HTML por arquetipo', () => {
  const h = (id: string) => labelAnchorHeight(unitById(CAMPUS_UNITS, id) as UnitDef);
  assert.equal(h('avor'), 10.5);
  assert.equal(h('projektleitung'), 7.75);
  assert.equal(h('bau'), 4);
  assert.equal(h('einkauf'), 4 + 1.1);
  assert.equal(h('blech'), 2.3 + 1.25);
  assert.equal(h('werkhof'), 2.4 + 1.05);
});

const base = CAMPUS_UNITS[0] as UnitDef;
const make = (patch: Partial<UnitDef>): UnitDef => ({ ...base, subunits: [], ...patch });

test('validateCampus detecta ids y códigos duplicados', () => {
  const units = [make({ id: 'avor', code: '01' }), make({ id: 'avor', code: '01', parent: null })];
  const problems = validateCampus(units, { requireFullCoverage: false });
  assert.ok(problems.some((p) => p.includes('id duplicado')));
  assert.ok(problems.some((p) => p.includes('código duplicado')));
});

test('validateCampus detecta padres inexistentes, de otro distrito y niveles incoherentes', () => {
  const units = [
    make({ id: 'avor', code: '01', level: 0, parent: null, methadesk: ['avor'] }),
    make({ id: 'einkauf', code: '02', level: 2, parent: 'avor', methadesk: ['einkauf'] }),
    make({ id: 'bau', code: '08', level: 1, parent: 'bauleitung', district: 'project', methadesk: ['bau'] }),
    make({ id: 'werkhof', code: '05', level: 1, parent: 'avor', district: 'project', methadesk: ['werkhof'] }),
  ];
  const problems = validateCampus(units, { requireFullCoverage: false });
  assert.ok(problems.some((p) => p.includes('einkauf') && p.includes('nivel')));
  assert.ok(problems.some((p) => p.includes('bau') && p.includes('padre inexistente')));
  assert.ok(problems.some((p) => p.includes('werkhof') && p.includes('otro distrito')));
});

test('validateCampus señala solo las unidades que forman el ciclo', () => {
  const units = [
    make({ id: 'avor', code: '01', level: 1, parent: 'einkauf', methadesk: ['avor'] }),
    make({ id: 'einkauf', code: '02', level: 1, parent: 'avor', methadesk: ['einkauf'] }),
    make({ id: 'werkhof', code: '05', level: 2, parent: 'avor', methadesk: ['werkhof'] }),
  ];
  const cycles = validateCampus(units, { requireFullCoverage: false }).filter((p) => p.includes('ciclo'));
  assert.deepEqual(cycles.map((p) => p.split(':')[0]).sort(), ['avor', 'einkauf']);
});

test('validateCampus detecta enlaces de coordinación hacia unidades inexistentes', () => {
  const problems = validateCampus(CAMPUS_UNITS, { coordination: [{ from: 'avor', to: 'fantasma' }] });
  assert.deepEqual(problems, ['coordinación avor ↔ fantasma: unidad inexistente fantasma']);
});

test('validateCampus detecta subunidades repetidas', () => {
  const sub = { id: 'planer' as const, methadesk: [] as const, external: false };
  const units = [
    make({ id: 'avor', code: '01', methadesk: ['avor'], subunits: [sub] }),
    make({ id: 'einkauf', code: '02', level: 1, parent: 'avor', methadesk: ['einkauf'], subunits: [sub] }),
  ];
  assert.ok(validateCampus(units, { requireFullCoverage: false }).includes('subunidad repetida: planer'));
});

test('deriveRelations ignora enlaces de coordinación a unidades que no existen', () => {
  const relations = deriveRelations(CAMPUS_UNITS, [{ from: 'avor', to: 'fantasma' }]);
  assert.equal(relations.filter((r) => r.kind === 'coordination').length, 0);
});

test('validateCampus exige que cada departamento de MethaDesk esté asignado exactamente una vez', () => {
  const duplicated = [
    make({ id: 'avor', code: '01', methadesk: ['avor', 'einkauf'] }),
    make({ id: 'einkauf', code: '02', level: 1, parent: 'avor', methadesk: ['einkauf'] }),
  ];
  const problems = validateCampus(duplicated);
  assert.ok(problems.some((p) => p.includes('einkauf') && p.includes('más de una')));
  assert.ok(problems.some((p) => p.includes('sin asignar')));
});
