import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTimeDe } from './relativeTime';

const NOW = new Date('2026-10-21T10:00:00Z');
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

test('menos de 45 segundos es «gerade eben»', () => {
  assert.equal(relativeTimeDe(ago(10), NOW), 'gerade eben');
  assert.equal(relativeTimeDe(ago(-5), NOW), 'gerade eben');
});

test('minutos, horas y días en alemán', () => {
  assert.match(relativeTimeDe(ago(120), NOW), /^vor 2 Min\.?$/);
  assert.match(relativeTimeDe(ago(3 * 3600), NOW), /^vor 3 Std\.?$/);
  assert.match(relativeTimeDe(ago(2 * 86_400), NOW), /vorgestern|vor 2 (Tagen|T\.)/);
});
