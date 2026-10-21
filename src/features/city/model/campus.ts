import { deepFreeze } from '@/lib/freeze';
import type { UnitDef, UnitId } from './types';

/**
 * Unidades de la ciudad tal como están en preview/preview.html (posición, tamaño, arquetipo,
 * jerarquía). Los textos (papel y descripción) viven en el catálogo de i18n.
 * Subunidades: decisión D2 de PLAN-DESARROLLO.md.
 */
export const CAMPUS_UNITS: readonly UnitDef[] = deepFreeze([
  {
    id: 'avor', code: '01', name: 'Produktion / AVOR', district: 'industrial', level: 0, parent: null,
    archetype: 'tower', position: { x: -6, z: -1 }, size: { w: 4.7, d: 3.5, h: 8.8 },
    methadesk: ['avor'], subunits: [], agent: 'avor',
  },
  {
    id: 'einkauf', code: '02', name: 'Einkauf', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'office', position: { x: -15, z: -7 }, size: { w: 3.5, d: 3.4, h: 4 },
    methadesk: ['einkauf'],
    subunits: [{ id: 'unternehmer', methadesk: ['unternehmer'], external: true }],
    agent: 'einkauf',
  },
  {
    id: 'schlosserei', code: '03', name: 'Schlosserei', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'factory', position: { x: -15, z: 3.7 }, size: { w: 5.8, d: 4.1, h: 2.8 },
    methadesk: ['schlosserei'], subunits: [], agent: 'schlosserei',
  },
  {
    id: 'blech', code: '04', name: 'Blechabteilung', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'sawtooth', position: { x: -6.6, z: 9 }, size: { w: 5.7, d: 3.8, h: 2.3 },
    methadesk: ['blech'], subunits: [], agent: 'blech',
  },
  {
    id: 'werkhof', code: '05', name: 'Werkhof', district: 'industrial', level: 1, parent: 'avor',
    archetype: 'logistics', position: { x: -3, z: -10 }, size: { w: 4.5, d: 3.8, h: 2.4 },
    methadesk: ['werkhof'], subunits: [], agent: 'werkhof',
  },
  {
    id: 'projektleitung', code: '06', name: 'Projektleitung', district: 'project', level: 0, parent: null,
    archetype: 'terrace', position: { x: 8.5, z: -8 }, size: { w: 3.8, d: 3.5, h: 6.9 },
    methadesk: ['projektleiter'],
    subunits: [{ id: 'planer', methadesk: ['planer'], external: false }],
    agent: 'projektleitung',
  },
  {
    id: 'bauleitung', code: '07', name: 'Bauleitung', district: 'project', level: 1, parent: 'projektleitung',
    archetype: 'office', position: { x: 13, z: 1 }, size: { w: 4, d: 3.1, h: 4.5 },
    methadesk: ['bauleiter'], subunits: [], agent: 'bauleitung',
  },
  {
    id: 'bau', code: '08', name: 'Bau', district: 'project', level: 2, parent: 'bauleitung',
    archetype: 'site', position: { x: 9.3, z: 9.5 }, size: { w: 4.8, d: 4.1, h: 2.8 },
    methadesk: ['bau'],
    subunits: [
      { id: 'montage', methadesk: ['montage'], external: false },
      { id: 'subunternehmer', methadesk: ['subunternehmer'], external: true },
    ],
    agent: 'bau',
  },
]);

/** Enlaces transversales entre distritos (además de las relaciones padre → hijo). */
export const CAMPUS_COORDINATION: readonly { readonly from: UnitId; readonly to: UnitId }[] = deepFreeze([
  { from: 'avor', to: 'bauleitung' },
]);

/** Perfil de Hermes del orquestador; no tiene edificio (decisión D1). */
export const ORCHESTRATOR_AGENT = 'chief';
