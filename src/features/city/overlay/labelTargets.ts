import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { labelAnchorHeight } from '@/features/city/model/hierarchy';
import type { ProjectSite } from '@/features/city/model/projects';
import { SITE_LABEL_HEIGHT } from '@/features/city/scene/builder/projectSites';

/** Qué se etiqueta en la ciudad: los edificios del campus y las obras de los proyectos (F5c). */
export interface LabelTarget {
  readonly id: string;
  readonly name: string;
  /** Tipo de rótulo superior (el texto lo pone la interfaz, en alemán). */
  readonly kicker: { readonly kind: 'orchestrator' | 'campus' } | { readonly kind: 'site'; readonly nr: string };
  /** Agente cuyo estado se muestra en el punto de la etiqueta. */
  readonly agentId: string;
  readonly anchor: readonly [number, number, number];
  /** Prioridad ante solapes (los edificios altos ganan). */
  readonly priority: number;
}

const CAMPUS_TARGETS: readonly LabelTarget[] = CAMPUS_UNITS.map((u) => ({
  id: u.id,
  name: u.name,
  kicker: { kind: u.parent === null && u.archetype === 'tower' ? 'orchestrator' : 'campus' },
  agentId: u.agent ?? u.id,
  anchor: [u.position.x, labelAnchorHeight(u), u.position.z],
  priority: u.size.h,
}));

export function labelTargets(sites: readonly ProjectSite[]): readonly LabelTarget[] {
  if (sites.length === 0) return CAMPUS_TARGETS;
  return [
    ...CAMPUS_TARGETS,
    ...sites.map((s) => ({
      id: s.id,
      name: s.projektname,
      kicker: { kind: 'site' as const, nr: s.projektnummer },
      agentId: s.agents.pl,
      anchor: [s.building.x, SITE_LABEL_HEIGHT, s.building.z] as const,
      priority: SITE_LABEL_HEIGHT,
    })),
  ];
}
