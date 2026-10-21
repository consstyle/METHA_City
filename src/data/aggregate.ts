import { departmentsOf } from '@/features/city/model/hierarchy';
import type { AbteilungId, UnitDef, UnitId } from '@/features/city/model/types';
import type {
  AbteilungKennzahlen, AgentState, DepartmentBreakdown, ProjectStatus, ProjektKennzahlen, UnitStatus,
} from './contract';

type CountKey = Exclude<keyof AbteilungKennzahlen, 'abteilung_id' | 'naechster_montagetermin' | 'hat_daten'>;

const OFFLINE: AgentState = Object.freeze({ state: 'offline', pendingApprovals: 0 });

/** Fila sin datos, como la devuelve la vista para un departamento sin TS ni grupos. */
export function emptyRow(id: AbteilungId): AbteilungKennzahlen {
  return {
    abteilung_id: id, ts_gesamt: 0, ts_offen: 0, ts_in_planung: 0, ts_offen_status: 0, ts_in_arbeit: 0,
    ts_bestellt: 0, ts_fertig: 0, ts_teilgeliefert: 0, ts_geliefert: 0, ts_verbaut: 0, ts_nachbearbeitung: 0,
    ts_express: 0, montage_ueberfaellig: 0, plan_ueberfaellig: 0, lieferung_ueberfaellig: 0,
    montage_naechste_14_tage: 0, abruf_aktiv: 0, naechster_montagetermin: null,
    gruppen_offen: 0, gruppen_in_arbeit: 0, gruppen_fertig: 0, hat_daten: false,
  };
}

const sum = (rows: readonly AbteilungKennzahlen[], key: CountKey) => rows.reduce((s, r) => s + r[key], 0);

function earliest(dates: readonly (string | null)[]): string | null {
  const valid = dates.filter((d): d is string => d !== null).sort();
  return valid[0] ?? null;
}

function breakdown(id: AbteilungId, row: AbteilungKennzahlen | undefined): DepartmentBreakdown {
  const r = row ?? emptyRow(id);
  return {
    abteilungId: id, present: r.hat_daten, tsTotal: r.ts_gesamt, tsOffen: r.ts_offen,
    montageUeberfaellig: r.montage_ueberfaellig, nachbearbeitung: r.ts_nachbearbeitung,
  };
}

function unitStatus(unit: UnitDef, byId: ReadonlyMap<AbteilungId, AbteilungKennzahlen>, agent: AgentState): UnitStatus {
  const ids = departmentsOf(unit);
  const rows = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  return {
    unitId: unit.id,
    hasData: rows.some((r) => r.hat_daten),
    ts: {
      total: sum(rows, 'ts_gesamt'), offen: sum(rows, 'ts_offen'), inPlanung: sum(rows, 'ts_in_planung'),
      offenStatus: sum(rows, 'ts_offen_status'), inArbeit: sum(rows, 'ts_in_arbeit'), bestellt: sum(rows, 'ts_bestellt'),
      fertig: sum(rows, 'ts_fertig'), teilgeliefert: sum(rows, 'ts_teilgeliefert'), geliefert: sum(rows, 'ts_geliefert'),
      verbaut: sum(rows, 'ts_verbaut'), nachbearbeitung: sum(rows, 'ts_nachbearbeitung'), express: sum(rows, 'ts_express'),
    },
    alerts: {
      montageUeberfaellig: sum(rows, 'montage_ueberfaellig'), planUeberfaellig: sum(rows, 'plan_ueberfaellig'),
      lieferungUeberfaellig: sum(rows, 'lieferung_ueberfaellig'), nachbearbeitung: sum(rows, 'ts_nachbearbeitung'),
      express: sum(rows, 'ts_express'), abrufAktiv: sum(rows, 'abruf_aktiv'),
      montageNaechste14Tage: sum(rows, 'montage_naechste_14_tage'),
    },
    naechsterMontagetermin: earliest(rows.map((r) => r.naechster_montagetermin)),
    gruppen: { offen: sum(rows, 'gruppen_offen'), inArbeit: sum(rows, 'gruppen_in_arbeit'), fertig: sum(rows, 'gruppen_fertig') },
    departments: ids.map((id) => breakdown(id, byId.get(id))),
    agent: { ...agent },
  };
}

/**
 * Agrega las filas por departamento en el estado de cada unidad de la ciudad.
 * Las filas deben venir ya validadas y sin duplicados (`parseAbteilungRows`).
 */
export function aggregateUnits(
  units: readonly UnitDef[],
  rows: readonly AbteilungKennzahlen[],
  agents: Readonly<Partial<Record<UnitId, AgentState>>> = {},
): UnitStatus[] {
  const byId = new Map(rows.map((r) => [r.abteilung_id, r] as const));
  return units.map((u) => unitStatus(u, byId, agents[u.id] ?? OFFLINE));
}

/** Proyectos activos para la interfaz; los archivados se descartan aunque la consulta los traiga. */
export function mapProjects(rows: readonly ProjektKennzahlen[]): ProjectStatus[] {
  return rows
    .filter((r) => !r.archived)
    .map((r) => ({
      projektId: r.projektId,
      projektnummer: r.projektnummer,
      projektname: r.projektname ?? r.projektnummer,
      tsTotal: r.ts_gesamt,
      tsVerbaut: r.ts_verbaut,
      verbautProzent: r.ts_verbaut_prozent,
      montageUeberfaellig: r.montage_ueberfaellig,
      nachbearbeitung: r.ts_nachbearbeitung,
      express: r.ts_express,
      abrufAktiv: r.abruf_aktiv,
      naechsterMontagetermin: r.naechster_montagetermin,
    }));
}
