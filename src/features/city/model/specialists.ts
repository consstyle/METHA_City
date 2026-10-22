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

/** F5c: todos sirven a un edificio del campus (las obras tienen su propio equipo de proyecto). */
export const SPECIALISTS: readonly SpecialistDef[] = deepFreeze([
  { id: 'kalkulation', district: 'industrial', unitId: 'avor' },
  { id: 'terminplanung', district: 'industrial', unitId: 'planer' },
  { id: 'qualitaet', district: 'industrial', unitId: 'schlosserei' },
  { id: 'arbeitssicherheit', district: 'industrial', unitId: 'werkhof' },
  { id: 'dokumentation', district: 'industrial', unitId: 'planer' },
  { id: 'controlling', district: 'industrial', unitId: 'avor' },
  { id: 'personal', district: 'industrial', unitId: 'avor' },
  { id: 'lieferanten', district: 'industrial', unitId: 'einkauf' },
  { id: 'logistik', district: 'industrial', unitId: 'werkhof' },
  { id: 'bim', district: 'industrial', unitId: 'planer' },
  { id: 'nachkalkulation', district: 'industrial', unitId: 'avor' },
  { id: 'kundendienst', district: 'industrial', unitId: 'avor' },
  { id: 'it', district: 'industrial', unitId: 'avor' },
  { id: 'recht', district: 'industrial', unitId: 'einkauf' },
]);

export function specialistById(id: string): SpecialistDef | undefined {
  return SPECIALISTS.find((s) => s.id === id);
}

/** Agentes fijos: el orquestador, uno por edificio del campus y los especialistas del catálogo. */
const AGENT_IDS: ReadonlySet<string> = new Set([ORCHESTRATOR_AGENT, ...CAMPUS_UNITS.map((u) => u.agent ?? u.id), ...SPECIALIST_IDS]);
/** Agentes de proyecto (D28): Projektleitung y Bauleitung de cada obra, p. ej. `pl-dev-001`. */
export const PROJECT_AGENT_PATTERN = /^(pl|bl)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Id de agente con forma válida (los de proyecto dependen de los proyectos activos: se comprueba en el cliente). */
export const isKnownAgent = (id: string | undefined): id is string =>
  id !== undefined && id.length <= 80 && (AGENT_IDS.has(id) || PROJECT_AGENT_PATTERN.test(id));

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
  { id: 'i5', district: 'industrial', x: 12.5, z: -3.75 },
  { id: 'i6', district: 'industrial', x: 14.75, z: 6.5 },
  { id: 'i7', district: 'industrial', x: 19.25, z: 0.75 },
  { id: 'i8', district: 'industrial', x: 7.25, z: 3.25 },
]);
