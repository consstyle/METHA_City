import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, formatDateCh, timeInZurich, todayInZurich } from './dates';

test('formatDateCh escribe la fecha al estilo suizo sin correrse de día', () => {
  assert.equal(formatDateCh('2026-10-26'), '26.10.2026');
  assert.equal(formatDateCh('2027-01-01'), '01.01.2027');
});

test('timeInZurich muestra la hora local de Zúrich en formato 24 h', () => {
  assert.equal(timeInZurich('2026-10-21T10:05:00Z', 'de-CH'), '12:05');
  // En invierno Zúrich está en UTC+1
  assert.equal(timeInZurich('2026-12-21T10:05:00Z', 'de-CH'), '11:05');
});

test('todayInZurich usa la fecha local de Zúrich, no la UTC', () => {
  // 23:30 UTC del 21 de octubre ya es 22 de octubre en Zúrich (UTC+2 en verano)
  assert.equal(todayInZurich(new Date('2026-10-21T23:30:00Z')), '2026-10-22');
  assert.equal(todayInZurich(new Date('2026-10-21T10:00:00Z')), '2026-10-21');
});

test('addDaysIso suma y resta días cruzando meses y años', () => {
  assert.equal(addDaysIso('2026-10-21', 5), '2026-10-26');
  assert.equal(addDaysIso('2026-10-30', 3), '2026-11-02');
  assert.equal(addDaysIso('2026-01-02', -5), '2025-12-28');
  assert.equal(addDaysIso('2026-03-28', 1), '2026-03-29');
});

test('addDaysIso rechaza fechas mal escritas o inexistentes', () => {
  assert.throws(() => addDaysIso('21.10.2026', 1), /AAAA-MM-DD/);
  assert.throws(() => addDaysIso('2026-02-31', 0), /existente/);
  assert.throws(() => addDaysIso('2026-13-01', 0), /existente/);
});

test('todayInZurich cruza bien el cambio de hora de octubre', () => {
  // 25-10-2026 01:30 UTC = 03:30 CEST → 02:30 CET; sigue siendo 25 de octubre en Zúrich
  assert.equal(todayInZurich(new Date('2026-10-25T01:30:00Z')), '2026-10-25');
  // 22:59 UTC del 24-10 = 00:59 del 25-10 en Zúrich (todavía en verano)
  assert.equal(todayInZurich(new Date('2026-10-24T22:59:00Z')), '2026-10-25');
});

test('timeInZurich muestra la medianoche como 00, no como 24', () => {
  assert.equal(timeInZurich('2026-10-20T22:05:00Z', 'de-CH'), '00:05');
});
