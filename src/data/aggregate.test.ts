import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { ABTEILUNG_IDS } from '@/features/city/model/types';
import { aggregateUnits, emptyRow, mapProjects } from './aggregate';
import type { AbteilungKennzahlen, ProjektKennzahlen } from './contract';

/** Fila con datos (hat_daten = true) a partir de una vacía. */
const row = (id: AbteilungKennzahlen['abteilung_id'], patch: Partial<AbteilungKennzahlen> = {}): AbteilungKennzahlen => ({
  ...emptyRow(id),
  hat_daten: true,
  ...patch,
});

test('suma los departamentos de la unidad y de sus subunidades', () => {
  const rows = [
    row('bau', { ts_gesamt: 4, ts_offen: 2, montage_ueberfaellig: 1, ts_nachbearbeitung: 1 }),
    row('montage', { ts_gesamt: 3, ts_offen: 3, montage_ueberfaellig: 2 }),
    row('subunternehmer', { ts_gesamt: 1, ts_express: 1 }),
    row('avor', { ts_gesamt: 99 }),
  ];
  const bau = aggregateUnits(CAMPUS_UNITS, rows).find((u) => u.unitId === 'bau');
  assert.equal(bau?.ts.total, 8);
  assert.equal(bau?.ts.offen, 5);
  assert.equal(bau?.alerts.montageUeberfaellig, 3);
  assert.equal(bau?.alerts.nachbearbeitung, 1);
  assert.equal(bau?.alerts.express, 1);
  assert.equal(bau?.hasData, true);
});

test('cada columna de la vista llega a su campo (valores distintos por columna)', () => {
  const r = row('avor', {
    ts_gesamt: 101, ts_offen: 103, ts_in_planung: 107, ts_offen_status: 109, ts_in_arbeit: 113, ts_bestellt: 127,
    ts_fertig: 131, ts_teilgeliefert: 137, ts_geliefert: 139, ts_verbaut: 149, ts_nachbearbeitung: 151, ts_express: 157,
    montage_ueberfaellig: 163, plan_ueberfaellig: 167, lieferung_ueberfaellig: 173, montage_naechste_14_tage: 179,
    abruf_aktiv: 181, gruppen_offen: 191, gruppen_in_arbeit: 193, gruppen_fertig: 197, naechster_montagetermin: '2026-11-05',
  });
  const avor = aggregateUnits(CAMPUS_UNITS, [r]).find((u) => u.unitId === 'avor');
  assert.deepEqual(avor?.ts, {
    total: 101, offen: 103, inPlanung: 107, offenStatus: 109, inArbeit: 113, bestellt: 127, fertig: 131,
    teilgeliefert: 137, geliefert: 139, verbaut: 149, nachbearbeitung: 151, express: 157,
  });
  assert.deepEqual(avor?.alerts, {
    montageUeberfaellig: 163, planUeberfaellig: 167, lieferungUeberfaellig: 173, nachbearbeitung: 151,
    express: 157, abrufAktiv: 181, montageNaechste14Tage: 179,
  });
  assert.deepEqual(avor?.gruppen, { offen: 191, inArbeit: 193, fertig: 197 });
  assert.equal(avor?.naechsterMontagetermin, '2026-11-05');
  assert.deepEqual(avor?.departments, [
    { abteilungId: 'avor', present: true, tsTotal: 101, tsOffen: 103, montageUeberfaellig: 163, nachbearbeitung: 151 },
  ]);
});

test('el desglose por departamento sigue el orden unidad → subunidades y marca los que no tienen datos', () => {
  const rows = [row('bau', { ts_gesamt: 4 }), emptyRow('montage')];
  const bau = aggregateUnits(CAMPUS_UNITS, rows).find((u) => u.unitId === 'bau');
  assert.deepEqual(
    bau?.departments.map((d) => [d.abteilungId, d.present, d.tsTotal]),
    [
      ['bau', true, 4],
      ['montage', false, 0],
      ['subunternehmer', false, 0],
    ],
  );
});

test('las 12 filas a cero que devuelve la vista sin datos dejan todas las unidades sin datos', () => {
  const units = aggregateUnits(CAMPUS_UNITS, ABTEILUNG_IDS.map(emptyRow));
  assert.equal(units.length, 8);
  assert.ok(units.every((u) => u.hasData === false && u.ts.total === 0));
});

test('sin ninguna fila las unidades también quedan sin datos', () => {
  assert.ok(aggregateUnits(CAMPUS_UNITS, []).every((u) => !u.hasData));
});

test('una unidad tiene datos si al menos uno de sus departamentos los tiene', () => {
  const rows = [emptyRow('bau'), row('montage', { gruppen_offen: 1 }), emptyRow('subunternehmer')];
  assert.equal(aggregateUnits(CAMPUS_UNITS, rows).find((u) => u.unitId === 'bau')?.hasData, true);
});

test('el próximo montaje es la fecha más temprana de sus departamentos', () => {
  const rows = [
    row('bau', { naechster_montagetermin: '2026-11-20' }),
    row('montage', { naechster_montagetermin: '2026-11-03' }),
    row('subunternehmer', { naechster_montagetermin: null }),
  ];
  const bau = aggregateUnits(CAMPUS_UNITS, rows).find((u) => u.unitId === 'bau');
  assert.equal(bau?.naechsterMontagetermin, '2026-11-03');
});

test('los estados de agente se aplican por unidad y se copian, no se comparten', () => {
  const working = { state: 'working' as const, pendingApprovals: 2 };
  const units = aggregateUnits(CAMPUS_UNITS, [], { schlosserei: working });
  const s = units.find((u) => u.unitId === 'schlosserei');
  assert.deepEqual(s?.agent, working);
  assert.notEqual(s?.agent, working);
  const offline = units.filter((u) => u.unitId !== 'schlosserei').map((u) => u.agent);
  assert.deepEqual(offline[0], { state: 'offline', pendingApprovals: 0 });
  assert.notEqual(offline[0], offline[1]);
});

test('no muta las filas de entrada', () => {
  const rows = Object.freeze([Object.freeze(row('bau', { ts_gesamt: 1 }))]);
  assert.doesNotThrow(() => aggregateUnits(CAMPUS_UNITS, rows));
});

const project = (patch: Partial<ProjektKennzahlen> = {}): ProjektKennzahlen => ({
  projektId: 'id-1', projektnummer: 'DEV-001', projektname: 'Schulhaus Demo', archived: false, ts_gesamt: 16,
  ts_verbaut: 2, ts_nachbearbeitung: 1, ts_express: 1, ts_verbaut_prozent: 12.5, montage_ueberfaellig: 4,
  abruf_aktiv: 0, naechster_montagetermin: '2026-10-24', ...patch,
});

test('mapProjects convierte las filas de proyecto al contrato', () => {
  assert.deepEqual(mapProjects([project()]), [{
    projektId: 'id-1', projektnummer: 'DEV-001', projektname: 'Schulhaus Demo', tsTotal: 16, tsVerbaut: 2,
    verbautProzent: 12.5, montageUeberfaellig: 4, nachbearbeitung: 1, express: 1, abrufAktiv: 0,
    naechsterMontagetermin: '2026-10-24',
  }]);
});

test('mapProjects usa el número de proyecto si falta el nombre y descarta los archivados', () => {
  const out = mapProjects([project({ projektname: null }), project({ projektId: 'id-2', archived: true })]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.projektname, 'DEV-001');
  assert.equal(mapProjects([project({ ts_verbaut_prozent: null })])[0]?.verbautProzent, null);
});
