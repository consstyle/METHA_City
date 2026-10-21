import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRow } from './aggregate';
import { AbteilungKennzahlenSchema, CitySnapshotSchema, ProjektKennzahlenSchema, parseAbteilungRows } from './contract';

const valid = { ...emptyRow('bau'), ts_gesamt: 3, ts_offen: 3, ts_in_arbeit: 3, hat_daten: true };

test('los recuentos aceptan números y texto de dígitos (bigint de Postgres)', () => {
  assert.equal(AbteilungKennzahlenSchema.parse({ ...valid, ts_gesamt: '12' }).ts_gesamt, 12);
  assert.equal(AbteilungKennzahlenSchema.parse({ ...valid, ts_gesamt: 7 }).ts_gesamt, 7);
});

test('los recuentos no convierten null, vacío, booleanos ni negativos en cifras creíbles', () => {
  for (const bad of [null, '', true, [], -1, '1.5', 'abc']) {
    assert.equal(AbteilungKennzahlenSchema.safeParse({ ...valid, ts_gesamt: bad }).success, false, `aceptó ${JSON.stringify(bad)}`);
  }
});

test('las fechas tienen que existir de verdad', () => {
  assert.equal(AbteilungKennzahlenSchema.safeParse({ ...valid, naechster_montagetermin: '2026-11-03' }).success, true);
  for (const bad of ['2026-02-31', '2026-13-45', '03.11.2026', '2026-11-03T00:00:00Z']) {
    assert.equal(AbteilungKennzahlenSchema.safeParse({ ...valid, naechster_montagetermin: bad }).success, false, bad);
  }
});

test('el porcentaje de proyecto acepta numeric de Postgres y rechaza valores fuera de 0–100', () => {
  const base = {
    projektId: 'p1', projektnummer: 'P1', projektname: null, archived: false, ts_gesamt: 1, ts_verbaut: 0,
    ts_nachbearbeitung: 0, ts_express: 0, montage_ueberfaellig: 0, abruf_aktiv: 0, naechster_montagetermin: null,
  };
  assert.equal(ProjektKennzahlenSchema.parse({ ...base, ts_verbaut_prozent: '12.5' }).ts_verbaut_prozent, 12.5);
  assert.equal(ProjektKennzahlenSchema.parse({ ...base, ts_verbaut_prozent: null }).ts_verbaut_prozent, null);
  assert.equal(ProjektKennzahlenSchema.safeParse({ ...base, ts_verbaut_prozent: '120' }).success, false);
  assert.equal(ProjektKennzahlenSchema.safeParse({ ...base, projektId: '' }).success, false);
});

test('el snapshot acepta instantes con desplazamiento y rechaza unidades repetidas', () => {
  const base = { source: 'mock', generatedAt: '2026-10-21T12:00:00+02:00', dataAsOf: null, units: [], projects: [] };
  assert.equal(CitySnapshotSchema.safeParse(base).success, true);
  const unit = {
    unitId: 'bau', hasData: false,
    ts: { total: 0, offen: 0, inPlanung: 0, offenStatus: 0, inArbeit: 0, bestellt: 0, fertig: 0, teilgeliefert: 0, geliefert: 0, verbaut: 0, nachbearbeitung: 0, express: 0 },
    alerts: { montageUeberfaellig: 0, planUeberfaellig: 0, lieferungUeberfaellig: 0, nachbearbeitung: 0, express: 0, abrufAktiv: 0, montageNaechste14Tage: 0 },
    naechsterMontagetermin: null, gruppen: { offen: 0, inArbeit: 0, fertig: 0 }, departments: [],
    agent: { state: 'offline', pendingApprovals: 0 },
  };
  const result = CitySnapshotSchema.safeParse({ ...base, units: [unit, unit] });
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /unidad repetida: bau/);
});

test('parseAbteilungRows descarta filas inválidas, ids desconocidos y duplicados sin tumbar el resto', () => {
  const warn = mock.method(console, 'warn', () => undefined);
  try {
    const rows = parseAbteilungRows([
      valid,
      { ...valid, abteilung_id: 'neue_abteilung' },
      { ...valid, abteilung_id: 'avor', ts_gesamt: null },
      { ...valid, ts_gesamt: 99 },
      { ...emptyRow('avor') },
    ]);
    assert.deepEqual(rows.map((r) => [r.abteilung_id, r.ts_gesamt]), [['bau', 3], ['avor', 0]]);
    assert.equal(warn.mock.callCount(), 3);
  } finally {
    warn.mock.restore();
  }
});
