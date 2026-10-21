/** Tipos del modelo estático de la ciudad (ver PLAN-DESARROLLO.md §2 y §4.3). */

export const DISTRICT_IDS = ['industrial', 'project'] as const;
export type DistrictId = (typeof DISTRICT_IDS)[number];

export const UNIT_IDS = [
  'avor', 'einkauf', 'schlosserei', 'blech', 'werkhof', 'projektleitung', 'bauleitung', 'bau',
] as const;
export type UnitId = (typeof UNIT_IDS)[number];

export const ARCHETYPES = ['tower', 'office', 'terrace', 'factory', 'sawtooth', 'logistics', 'site'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Ids de ABTEILUNGEN_CONFIG de MethaDesk (src/types/index.ts). */
export const ABTEILUNG_IDS = [
  'projektleiter', 'bauleiter', 'planer', 'einkauf', 'avor', 'schlosserei',
  'blech', 'werkhof', 'montage', 'bau', 'subunternehmer', 'unternehmer',
] as const;
export type AbteilungId = (typeof ABTEILUNG_IDS)[number];

/** Departamento sin edificio propio que se muestra dentro de una unidad (nombre: ABTEILUNGEN). */
export interface SubunitDef {
  readonly id: AbteilungId;
  readonly methadesk: readonly AbteilungId[];
  /** Empresa externa (subcontratista, contratista) y no un departamento propio. */
  readonly external: boolean;
}

export interface UnitDef {
  readonly id: UnitId;
  readonly code: string;
  readonly name: string;
  readonly district: DistrictId;
  readonly level: number;
  readonly parent: UnitId | null;
  readonly archetype: Archetype;
  readonly position: { readonly x: number; readonly z: number };
  readonly size: { readonly w: number; readonly d: number; readonly h: number };
  /** Departamentos de MethaDesk cuyos indicadores se suman en esta unidad. */
  readonly methadesk: readonly AbteilungId[];
  readonly subunits: readonly SubunitDef[];
  /** Perfil de Hermes del agente de la unidad. */
  readonly agent: string | null;
}

export type RelationKind = 'hierarchy' | 'coordination';

export interface RelationDef {
  readonly from: UnitId;
  readonly to: UnitId;
  readonly kind: RelationKind;
}
