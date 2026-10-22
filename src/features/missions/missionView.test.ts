import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockDataSource } from '@/data/mock/MockDataSource';
import { contextFromSnapshot, parseReport, reportFileName } from './missionView';

const T = new Date('2026-10-22T09:00:00Z');

test('la foto de MethaDesk suma las unidades con datos; sin datos o con error se dice', async () => {
  const snapshot = await new MockDataSource({ scenario: 'normal', now: () => T }).getSnapshot();
  const c = contextFromSnapshot({ ok: true, snapshot })!;
  const withData = snapshot.units.filter((u) => u.hasData);
  assert.equal(c.hasData, true);
  assert.equal(c.total, withData.reduce((s, u) => s + u.ts.total, 0));
  assert.equal(contextFromSnapshot({ ok: false }), null);
  const empty = await new MockDataSource({ scenario: 'leer', now: () => T }).getSnapshot();
  assert.equal(contextFromSnapshot({ ok: true, snapshot: empty })!.hasData, false);
});

test('el informe Markdown se convierte en bloques (títulos, listas, cita, firma)', () => {
  const blocks = parseReport('# Bericht: X\n_Erstellt von Chief_\n\n## Vorgehen\n- **Bau**: Montage prüfen\n- Ohne Fett\n\n> Hinweis\nText');
  assert.deepEqual(blocks.map((b) => b.type), ['h1', 'byline', 'h2', 'list', 'quote', 'p']);
  assert.deepEqual(blocks[3], { type: 'list', items: [{ strong: 'Bau', text: 'Montage prüfen' }, { strong: null, text: 'Ohne Fett' }] });
});

test('nombre de archivo del informe sin acentos ni símbolos', () => {
  assert.equal(reportFileName('Überfällige Montagen: Woche 43!'), 'bericht-uberfallige-montagen-woche-43.md');
  assert.equal(reportFileName('«»'), 'bericht-mission.md');
});
