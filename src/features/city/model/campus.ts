import { deepFreeze } from '@/lib/freeze';
import type { AbteilungId, UnitDef, UnitId } from './types';

/**
 * Edificios del campus de METHABAU tal como están en preview/preview.html (posición, tamaño,
 * arquetipo, jerarquía). Los textos (papel y descripción) viven en el catálogo de i18n.
 * F5c (D25): la ciudad es el campus; Projektleitung, Bauleitung y Bau pertenecen a cada proyecto
 * y se ven en las obras alrededor de la isla (`projects.ts`). El Planer tiene edificio propio.
 */
export const CAMPUS_UNITS: readonly UnitDef[] = deepFreeze([
  {
    id: 'avor', code: '01', name: 'Produktion / AVOR', district: 'industrial', level: 0, parent: null,
    archetype: 'tower', position: { x: -6, z: -1 }, size: { w: 4.7, d: 3.5, h: 8.8 },
    methadesk: ['avor'], subunits: [], agent: 'avor',
  },
  {
    id: 'planer', code: '02', name: 'Planer', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'terrace', position: { x: 8.5, z: -8 }, size: { w: 3.8, d: 3.5, h: 6.9 },
    methadesk: ['planer'], subunits: [], agent: 'planer',
  },
  {
    id: 'einkauf', code: '03', name: 'Einkauf', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'office', position: { x: -15, z: -7 }, size: { w: 3.5, d: 3.4, h: 4 },
    methadesk: ['einkauf'],
    subunits: [{ id: 'unternehmer', methadesk: ['unternehmer'], external: true }],
    agent: 'einkauf',
  },
  {
    id: 'schlosserei', code: '04', name: 'Schlosserei', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'factory', position: { x: -15, z: 3.7 }, size: { w: 5.8, d: 4.1, h: 2.8 },
    methadesk: ['schlosserei'], subunits: [], agent: 'schlosserei',
  },
  {
    id: 'blech', code: '05', name: 'Blechabteilung', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'sawtooth', position: { x: -6.6, z: 9 }, size: { w: 5.7, d: 3.8, h: 2.3 },
    methadesk: ['blech'], subunits: [], agent: 'blech',
  },
  {
    id: 'werkhof', code: '06', name: 'Werkhof', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'logistics', position: { x: -3, z: -10 }, size: { w: 4.5, d: 3.8, h: 2.4 },
    methadesk: ['werkhof'], subunits: [], agent: 'werkhof',
  },
]);

/**
 * Enlaces transversales entre edificios del campus. La coordinación AVOR ↔ Bauleitung ahora es con
 * la Bauleitung de cada obra (agentes de proyecto), no con un edificio.
 */
export const CAMPUS_COORDINATION: readonly { readonly from: UnitId; readonly to: UnitId }[] = deepFreeze([]);

/** Departamentos de MethaDesk que trabajan en las obras (pertenecen a los proyectos, no al campus). */
export const PROJECT_DEPARTMENTS: readonly AbteilungId[] = deepFreeze(['projektleiter', 'bauleiter', 'montage', 'bau', 'subunternehmer']);

/** Perfil de Hermes del orquestador; no tiene edificio (decisión D1). */
export const ORCHESTRATOR_AGENT = 'chief';
