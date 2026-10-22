import { deepFreeze } from '@/lib/freeze';
import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from './campus';
import type { DistrictId, UnitId } from './types';

/**
 * Catálogo de especialistas contratables (PLAN-DESARROLLO.md §3.1, decisión D8). Cada uno
 * depende de la unidad que más lo necesita y, contratado, ocupa un pabellón en su distrito.
 * El id del papel es también el id del agente. Los textos viven en i18n (`specialists`).
 */

export const SPECIALIST_IDS = [
  'kalkulation', 'terminplanung', 'qualitaet', 'arbeitssicherheit', 'dokumentation', 'controlling', 'personal',
  'lieferanten', 'logistik', 'bim', 'nachkalkulation', 'kundendienst', 'it', 'recht',
] as const;
export type SpecialistId = (typeof SPECIALIST_IDS)[number];

export interface SpecialistDef {
  readonly id: SpecialistId;
  readonly district: DistrictId;
  /** Unidad a la que sirve: le delega trabajo y su pabellón se une a ella. */
  readonly unitId: UnitId;
}

export const SPECIALISTS: readonly SpecialistDef[] = deepFreeze([
  { id: 'kalkulation', district: 'project', unitId: 'projektleitung' },
  { id: 'terminplanung', district: 'project', unitId: 'projektleitung' },
  { id: 'qualitaet', district: 'industrial', unitId: 'schlosserei' },
  { id: 'arbeitssicherheit', district: 'project', unitId: 'bau' },
  { id: 'dokumentation', district: 'project', unitId: 'bauleitung' },
  { id: 'controlling', district: 'industrial', unitId: 'avor' },
  { id: 'personal', district: 'industrial', unitId: 'avor' },
  { id: 'lieferanten', district: 'industrial', unitId: 'einkauf' },
  { id: 'logistik', district: 'industrial', unitId: 'werkhof' },
  { id: 'bim', district: 'project', unitId: 'projektleitung' },
  { id: 'nachkalkulation', district: 'project', unitId: 'projektleitung' },
  { id: 'kundendienst', district: 'project', unitId: 'bauleitung' },
  { id: 'it', district: 'industrial', unitId: 'avor' },
  { id: 'recht', district: 'project', unitId: 'projektleitung' },
]);

export function specialistById(id: string): SpecialistDef | undefined {
  return SPECIALISTS.find((s) => s.id === id);
}

/** Todos los agentes posibles: el orquestador, uno por unidad y los especialistas del catálogo. */
const AGENT_IDS: ReadonlySet<string> = new Set([ORCHESTRATOR_AGENT, ...CAMPUS_UNITS.map((u) => u.agent ?? u.id), ...SPECIALIST_IDS]);

export const isKnownAgent = (id: string | undefined): id is string => id !== undefined && AGENT_IDS.has(id);

export interface PavilionLot {
  readonly id: string;
  readonly district: DistrictId;
  readonly x: number;
  readonly z: number;
}

/** Solares libres para pabellones (D14), elegidos con `clearance()` y comprobados en las pruebas. */
export const PAVILION_LOTS: readonly PavilionLot[] = deepFreeze([
  { id: 'i1', district: 'industrial', x: -10, z: -8.25 },
  { id: 'i2', district: 'industrial', x: -12.5, z: 10.5 },
  { id: 'i3', district: 'industrial', x: -15.5, z: -3.1 },
  { id: 'i4', district: 'industrial', x: -10, z: 2.9 },
  { id: 'p1', district: 'project', x: 12.5, z: -3.75 },
  { id: 'p2', district: 'project', x: 14.75, z: 6.5 },
  { id: 'p3', district: 'project', x: 19.25, z: 0.75 },
  { id: 'p4', district: 'project', x: 7.25, z: 3.25 },
]);
