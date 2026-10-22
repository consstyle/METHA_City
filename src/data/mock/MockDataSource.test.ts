import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CitySnapshotSchema } from '../contract';
import { MockDataSource, parseScenario } from './MockDataSource';
import {
  alertAbteilungen, alertProjekte, baselineAbteilungen, baselineProjekte, emptyAbteilungen, rowInvariantProblems,
} from './scenarios';

const NOW = () => new Date('2026-10-21T10:00:00Z');
const TODAY = '2026-10-21';

test('el escenario normal entrega un snapshot válido con las 6 unidades del campus y los 3 proyectos', async () => {
  const snap = await new MockDataSource({ scenario: 'normal', now: NOW }).getSnapshot();
  assert.doesNotThrow(() => CitySnapshotSchema.parse(snap));
  assert.equal(snap.source, 'mock');
  assert.equal(snap.units.length, 6);
  assert.deepEqual(snap.projects.map((p) => p.projektId), ['mock-DEV-001', 'mock-DEV-002', 'mock-DEV-003']);
  assert.equal(snap.dataAsOf, '2026-10-21T10:00:00.000Z');
});

test('el campus suma 28 Teilsysteme y los proyectos los 48 del seed (la obra no es del campus, F5c)', async () => {
  const snap = await new MockDataSource({ scenario: 'normal', now: NOW }).getSnapshot();
  assert.equal(snap.units.reduce((s, u) => s + u.ts.total, 0), 28);
  assert.equal(snap.projects.reduce((s, p) => s + p.tsTotal, 0), 48);
  assert.ok(snap.units.every((u) => u.hasData));
  assert.ok(snap.units.every((u) => u.agent.state === 'offline'));
});

test('las fechas del seed se recalculan respecto al día actual en Zúrich', async () => {
  const snap = await new MockDataSource({ scenario: 'normal', now: NOW }).getSnapshot();
  // En el seed, el próximo montaje de AVOR (sin subunidades) está a 6 días de hoy
  assert.equal(snap.units.find((u) => u.unitId === 'avor')?.naechsterMontagetermin, '2026-10-27');
  // Einkauf suma su subunidad Unternehmer, cuyo montaje (a 1 día) es anterior al suyo (a 5 días)
  assert.equal(snap.units.find((u) => u.unitId === 'einkauf')?.naechsterMontagetermin, '2026-10-22');
});

test('todos los escenarios respetan las reglas de la vista (estados, atrasos, hat_daten)', () => {
  const scenarios = { normal: baselineAbteilungen(TODAY), alarme: alertAbteilungen(TODAY), leer: emptyAbteilungen() };
  for (const [name, rows] of Object.entries(scenarios)) {
    assert.equal(rows.length, 12, `${name}: la vista devuelve siempre 12 departamentos`);
    assert.deepEqual(rows.flatMap(rowInvariantProblems), [], name);
  }
});

test('los proyectos de todos los escenarios respetan sus límites', () => {
  for (const p of [...baselineProjekte(TODAY), ...alertProjekte(TODAY)]) {
    const notInstalled = p.ts_gesamt - p.ts_verbaut;
    assert.ok(p.montage_ueberfaellig <= notInstalled, `${p.projektnummer}: montaje atrasado`);
    assert.ok(p.ts_nachbearbeitung + p.ts_express <= notInstalled, `${p.projektnummer}: estados`);
  }
});

test('el escenario de alarmas tiene más alertas que el normal y agentes trabajando', async () => {
  const normal = await new MockDataSource({ scenario: 'normal', now: NOW }).getSnapshot();
  const alarme = await new MockDataSource({ scenario: 'alarme', now: NOW }).getSnapshot();
  const sum = (s: typeof normal) => s.units.reduce((n, u) => n + u.alerts.montageUeberfaellig + u.alerts.nachbearbeitung, 0);
  assert.ok(sum(alarme) > sum(normal));
  assert.equal(alarme.units.reduce((s, u) => s + u.ts.total, 0), 28, 'mismo número de TS');
  assert.ok(alarme.units.some((u) => u.agent.state === 'working'));
  assert.ok(alarme.units.some((u) => u.agent.pendingApprovals > 0));
});

test('el escenario vacío reproduce la vista real (12 filas a cero) y no inventa ceros', async () => {
  const snap = await new MockDataSource({ scenario: 'leer', now: NOW }).getSnapshot();
  assert.ok(snap.units.every((u) => !u.hasData));
  assert.deepEqual(snap.projects, []);
});

test('el escenario de error rechaza la promesa', async () => {
  await assert.rejects(new MockDataSource({ scenario: 'fehler', now: NOW }).getSnapshot(), /simulado/);
});

test('respeta la cancelación con AbortSignal', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(new MockDataSource({ now: NOW }).getSnapshot({ signal: ctrl.signal }), { name: 'AbortError' });
});

test('la demora simulada se puede cancelar a mitad', async () => {
  const ctrl = new AbortController();
  const pending = new MockDataSource({ now: NOW, delayMs: 5_000 }).getSnapshot({ signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('la demora simulada se respeta cuando no se cancela', async () => {
  const start = Date.now();
  await new MockDataSource({ now: NOW, delayMs: 30 }).getSnapshot({ signal: new AbortController().signal });
  assert.ok(Date.now() - start >= 25);
});

test('parseScenario acepta los escenarios conocidos y vuelve a normal con valores desconocidos', () => {
  assert.equal(parseScenario('alarme'), 'alarme');
  assert.equal(parseScenario('leer'), 'leer');
  assert.equal(parseScenario('fehler'), 'fehler');
  assert.equal(parseScenario(undefined), 'normal');
  assert.equal(parseScenario('<script>'), 'normal');
  assert.equal(parseScenario('alertas'), 'normal');
  assert.equal(parseScenario(['alarme', 'leer']), 'alarme');
});
