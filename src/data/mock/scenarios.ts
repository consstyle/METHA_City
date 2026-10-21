import 'server-only';
import { addDaysIso } from '@/lib/dates';
import { ABTEILUNG_IDS, type UnitId } from '@/features/city/model/types';
import { emptyRow } from '../aggregate';
import {
  AbteilungKennzahlenSchema, ProjektKennzahlenSchema,
  type AbteilungKennzahlen, type AgentState, type ProjektKennzahlen,
} from '../contract';
import seed from './seed-kennzahlen.json';

/**
 * Escenarios del simulador. «normal» son los indicadores del seed sintético del VPS de desarrollo
 * (deploy/dev/replica/20_seed.sql): las fechas se guardan como días respecto a hoy.
 * Todos respetan las reglas de la vista (ver `rowInvariantProblems`).
 */
export const MOCK_SCENARIOS = ['normal', 'alarme', 'leer', 'fehler'] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

type StatusKey = 'ts_in_planung' | 'ts_offen_status' | 'ts_in_arbeit' | 'ts_bestellt' | 'ts_fertig'
  | 'ts_teilgeliefert' | 'ts_geliefert' | 'ts_verbaut' | 'ts_nachbearbeitung' | 'ts_express';

/** Los 10 estados de MethaDesk (ITEM_STATUS_OPTIONS): su suma es ts_gesamt. */
export const STATUS_KEYS: readonly StatusKey[] = [
  'ts_in_planung', 'ts_offen_status', 'ts_in_arbeit', 'ts_bestellt', 'ts_fertig',
  'ts_teilgeliefert', 'ts_geliefert', 'ts_verbaut', 'ts_nachbearbeitung', 'ts_express',
];
/** Estados abiertos de los que el escenario «alarme» saca TS para pasarlos a retrabajo o express. */
const OPEN_POOL: readonly StatusKey[] = ['ts_offen_status', 'ts_in_planung', 'ts_in_arbeit', 'ts_bestellt', 'ts_teilgeliefert'];

const withDate = (offset: number | null, today: string) => (offset === null ? null : addDaysIso(today, offset));

export function baselineAbteilungen(today: string): AbteilungKennzahlen[] {
  return seed.abteilungen.map(({ naechster_montagetermin_tage, ...rest }) =>
    AbteilungKennzahlenSchema.parse({
      ...rest,
      naechster_montagetermin: withDate(naechster_montagetermin_tage, today),
      hat_daten: rest.ts_gesamt > 0 || rest.gruppen_offen + rest.gruppen_in_arbeit + rest.gruppen_fertig > 0,
    }),
  );
}

export function baselineProjekte(today: string): ProjektKennzahlen[] {
  return seed.projekte.map(({ naechster_montagetermin_tage, ...rest }) =>
    ProjektKennzahlenSchema.parse({
      ...rest,
      projektId: `mock-${rest.projektnummer}`,
      archived: false,
      naechster_montagetermin: withDate(naechster_montagetermin_tage, today),
    }),
  );
}

/** La vista siempre devuelve los 12 departamentos: «sin datos» son 12 filas a cero sin hat_daten. */
export function emptyAbteilungen(): AbteilungKennzahlen[] {
  return ABTEILUNG_IDS.map(emptyRow);
}

/** Pasa hasta `amount` TS de los estados abiertos a `target` (no cambia ts_gesamt ni ts_offen). */
function moveToStatus(row: AbteilungKennzahlen, target: StatusKey, amount: number): AbteilungKennzahlen {
  return OPEN_POOL.reduce(
    ({ next, left }, key) => {
      const take = Math.min(next[key], left);
      return { next: { ...next, [key]: next[key] - take, [target]: next[target] + take }, left: left - take };
    },
    { next: row, left: amount },
  ).next;
}

/** Mismos datos con muchas más alertas, para probar la capa operativa. */
export function alertAbteilungen(today: string): AbteilungKennzahlen[] {
  return baselineAbteilungen(today).map((r) => {
    const moved = moveToStatus(moveToStatus(r, 'ts_nachbearbeitung', 2), 'ts_express', 1);
    const notInstalled = r.ts_gesamt - r.ts_verbaut;
    return {
      ...moved,
      montage_ueberfaellig: Math.min(notInstalled, r.montage_ueberfaellig + Math.ceil(r.ts_gesamt / 2)),
      abruf_aktiv: Math.min(r.ts_offen, r.abruf_aktiv + (r.ts_offen > 2 ? 1 : 0)),
    };
  });
}

export function alertProjekte(today: string): ProjektKennzahlen[] {
  return baselineProjekte(today).map((p) => {
    const notInstalled = p.ts_gesamt - p.ts_verbaut;
    return {
      ...p,
      montage_ueberfaellig: Math.min(notInstalled, p.montage_ueberfaellig + 5),
      ts_nachbearbeitung: Math.min(notInstalled - p.ts_express, p.ts_nachbearbeitung + 3),
    };
  });
}

/** Reglas que cumple cualquier fila real de mc.abteilung_kennzahlen; lista vacía si se cumplen. */
export function rowInvariantProblems(r: AbteilungKennzahlen): string[] {
  const statusSum = STATUS_KEYS.reduce((s, k) => s + r[k], 0);
  const notInstalled = r.ts_gesamt - r.ts_verbaut;
  const checks: [boolean, string][] = [
    [statusSum === r.ts_gesamt, `suma de estados ${statusSum} ≠ ts_gesamt ${r.ts_gesamt}`],
    [r.ts_offen === r.ts_gesamt - r.ts_fertig - r.ts_geliefert - r.ts_verbaut, 'ts_offen no cuadra con los estados'],
    [r.montage_ueberfaellig <= notInstalled, 'montaje atrasado mayor que los TS sin montar'],
    [r.montage_naechste_14_tage <= notInstalled, 'montajes próximos mayor que los TS sin montar'],
    [r.lieferung_ueberfaellig <= r.ts_gesamt - r.ts_geliefert - r.ts_verbaut, 'entrega atrasada mayor que los TS sin entregar'],
    [r.plan_ueberfaellig <= r.ts_gesamt, 'plan atrasado mayor que ts_gesamt'],
    [r.abruf_aktiv <= r.ts_gesamt, 'Abrufe activos mayor que ts_gesamt'],
    [r.hat_daten === (r.ts_gesamt > 0 || r.gruppen_offen + r.gruppen_in_arbeit + r.gruppen_fertig > 0), 'hat_daten incoherente'],
  ];
  return checks.filter(([ok]) => !ok).map(([, msg]) => `${r.abteilung_id}: ${msg}`);
}

/** Hermes aún no está conectado: salvo en «alarme», todos los agentes están desconectados. */
export function agentStates(scenario: MockScenario): Partial<Record<UnitId, AgentState>> {
  if (scenario !== 'alarme') return {};
  return {
    avor: { state: 'working', pendingApprovals: 2 },
    bauleitung: { state: 'working', pendingApprovals: 1 },
    einkauf: { state: 'idle', pendingApprovals: 0 },
    schlosserei: { state: 'working', pendingApprovals: 0 },
    projektleitung: { state: 'idle', pendingApprovals: 1 },
  };
}
