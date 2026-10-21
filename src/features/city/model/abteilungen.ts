import { deepFreeze } from '@/lib/freeze';
import type { AbteilungId } from './types';

export interface AbteilungDef {
  readonly id: AbteilungId;
  readonly name: string;
  /** Color de Tailwind que usa MethaDesk para el departamento. */
  readonly color: string;
}

/** Copia de ABTEILUNGEN_CONFIG de MethaDesk (src/types/index.ts). Mantener sincronizada. */
export const ABTEILUNGEN: readonly AbteilungDef[] = deepFreeze([
  { id: 'projektleiter', name: 'Projektleiter', color: 'indigo' },
  { id: 'bauleiter', name: 'Bauleitung', color: 'sky' },
  { id: 'planer', name: 'Planer', color: 'teal' },
  { id: 'einkauf', name: 'Einkauf', color: 'amber' },
  { id: 'avor', name: 'AVOR', color: 'purple' },
  { id: 'schlosserei', name: 'Schlosserei', color: 'slate' },
  { id: 'blech', name: 'Blechabteilung', color: 'orange' },
  { id: 'werkhof', name: 'Werkhof', color: 'violet' },
  { id: 'montage', name: 'Montage', color: 'green' },
  { id: 'bau', name: 'Bau', color: 'red' },
  { id: 'subunternehmer', name: 'Subunternehmer', color: 'cyan' },
  { id: 'unternehmer', name: 'Unternehmer', color: 'rose' },
]);

export function abteilungName(id: AbteilungId): string {
  return ABTEILUNGEN.find((a) => a.id === id)?.name ?? id;
}
