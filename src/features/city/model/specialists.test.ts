import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearance } from '@/features/city/scene/builder/clearance';
import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from './campus';
import { isKnownAgent, PAVILION_LOTS, SPECIALISTS, specialistById } from './specialists';

test('isKnownAgent reconoce al Chief, las unidades, los especialistas y los equipos de proyecto', () => {
  for (const id of ['chief', 'planer', 'avor', 'bim', 'recht', 'pl-dev-001', 'bl-dev-003']) assert.ok(isKnownAgent(id), id);
  for (const id of [undefined, '', 'nope', 'bau', 'bauleitung', 'pl-', 'xl-dev-001', 'pl-DEV-001', `pl-${'a'.repeat(80)}`]) {
    assert.equal(isKnownAgent(id), false, String(id));
  }
});

test('el catálogo tiene los 14 papeles de §3.1, con ids únicos que no chocan con unidades ni con el Chief', () => {
  assert.equal(SPECIALISTS.length, 14);
  const ids = SPECIALISTS.map((s) => s.id);
  assert.equal(new Set(ids).size, 14);
  const taken = new Set<string>([ORCHESTRATOR_AGENT, ...CAMPUS_UNITS.map((u) => u.agent ?? u.id)]);
  for (const id of ids) assert.ok(!taken.has(id), `${id} ya existe`);
});

test('cada especialista depende de una unidad de su mismo distrito', () => {
  for (const s of SPECIALISTS) {
    const unit = CAMPUS_UNITS.find((u) => u.id === s.unitId);
    assert.ok(unit, `${s.id}: unidad ${s.unitId} inexistente`);
    assert.equal(unit.district, s.district, s.id);
  }
});

test('hay 8 solares en el campus (las obras no tienen pabellones) y separados entre sí', () => {
  assert.equal(PAVILION_LOTS.length, 8);
  assert.ok(PAVILION_LOTS.every((l) => l.district === 'industrial'));
  for (const a of PAVILION_LOTS) for (const b of PAVILION_LOTS) {
    if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 3, `${a.id} y ${b.id} demasiado cerca`);
  }
});

test('los solares no pisan edificios, calles, plazas, árboles ni aparcamientos (D14)', () => {
  for (const l of PAVILION_LOTS) assert.ok(clearance(l.x, l.z) >= 1.4, `${l.id}: holgura ${clearance(l.x, l.z).toFixed(2)}`);
});

test('clearance es 0 sobre un edificio y fuera del anillo vial', () => {
  const avor = CAMPUS_UNITS[0]!;
  assert.equal(clearance(avor.position.x, avor.position.z), 0);
  assert.equal(clearance(30, 0), 0);
});

test('specialistById encuentra un papel y devuelve undefined para lo desconocido', () => {
  assert.equal(specialistById('bim')?.unitId, 'planer');
  assert.equal(specialistById('nope'), undefined);
});
