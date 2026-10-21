import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { format, getMessages, LOCALE } from './index';

const leaves = (obj: unknown, prefix = ''): [string, unknown][] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );

test('la interfaz está solo en alemán, como MethaDesk', () => {
  assert.equal(LOCALE, 'de');
});

test('ningún texto del catálogo está vacío', () => {
  for (const [k, v] of leaves(getMessages())) {
    assert.ok(typeof v === 'string' && v.trim().length > 0, `vacío: ${k}`);
  }
});

test('el catálogo sigue la ortografía suiza: sin «ß»', () => {
  const conEszett = leaves(getMessages()).filter(([, v]) => String(v).includes('ß'));
  assert.deepEqual(conEszett, []);
});

test('cada unidad del campus tiene papel y descripción', () => {
  const m = getMessages();
  for (const u of CAMPUS_UNITS) {
    assert.ok(m.units[u.id].role, `falta el papel de ${u.id}`);
    assert.ok(m.units[u.id].description, `falta la descripción de ${u.id}`);
  }
});

test('format sustituye variables y deja visibles las que faltan', () => {
  assert.equal(format('Datenstand {time}', { time: '10:00' }), 'Datenstand 10:00');
  assert.equal(format('{a} und {b}', { a: '1' }), '1 und {b}');
  // Las claves heredadas de Object no cuentan como variables
  assert.equal(format('{constructor} {toString}', {}), '{constructor} {toString}');
});
