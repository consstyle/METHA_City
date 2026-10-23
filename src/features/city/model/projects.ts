import { placeSites, SITE_PLATFORM } from './siteLayout';
import type { Point } from './streets';

export { SITE_PLATFORM };
export type { Point };

/**
 * Obras de los proyectos (F5c, D26–D27): cada proyecto activo de MethaDesk es una obra en su propia
 * plataforma alrededor de la isla, unida a AVOR por su propia calle recta, con su Projektleitung y
 * su Bauleitung. Funciones puras: la posición sale solo de la lista de proyectos (siteLayout.ts).
 */

export interface ProjectRef {
  readonly projektId: string;
  readonly projektnummer: string;
  readonly projektname: string;
}

export interface ProjectSite extends ProjectRef {
  /** Id seleccionable en la ciudad (`projekt:<projektId>`). */
  readonly id: string;
  /** Centro de la plataforma. */
  readonly position: Point;
  /** Ángulo alrededor de la isla (radianes). */
  readonly angle: number;
  /** Calle: de la puerta de AVOR al borde de la plataforma. */
  readonly road: readonly Point[];
  /** Agentes del proyecto (D28). */
  readonly agents: { readonly pl: string; readonly bl: string };
  /** Posición de las oficinas de obra y de la obra dentro de la plataforma. */
  readonly offices: { readonly pl: Point; readonly bl: Point };
  readonly building: Point;
}

export const projectSiteId = (projektId: string) => `projekt:${projektId}`;
export const parseSiteId = (id: string): string | null => (id.startsWith('projekt:') ? id.slice('projekt:'.length) : null);

/** Longitud máxima del slug (los ids de agente quedan por debajo del límite de isKnownAgent). */
const SLUG_MAX = 60;

const slug = (nr: string) =>
  nr.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, SLUG_MAX).replace(/^-+|-+$/g, '') || 'projekt';

export const projectAgentIds = (projektnummer: string) => ({ pl: `pl-${slug(projektnummer)}`, bl: `bl-${slug(projektnummer)}` });

export type TeamIds = { readonly pl: string; readonly bl: string };

/**
 * Ids de los agentes de cada proyecto, únicos aunque dos números den el mismo slug
 * («2024/01» y «2024-01»): el segundo lleva sufijo («-2»). Orden estable por número e id.
 */
export function projectTeamIds(projects: readonly ProjectRef[]): ReadonlyMap<string, TeamIds> {
  const sorted = [...projects].sort((a, b) => a.projektnummer.localeCompare(b.projektnummer) || a.projektId.localeCompare(b.projektId));
  const taken = new Set<string>();
  return new Map(sorted.map((p) => {
    const base = slug(p.projektnummer);
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    taken.add(s);
    return [p.projektId, { pl: `pl-${s}`, bl: `bl-${s}` }] as const;
  }));
}

const add = (p: Point, d: Point, k: number): Point => ({ x: p.x + d.x * k, z: p.z + d.z * k });

/** Las obras, ordenadas por número de proyecto, en los sitios de siteLayout (la primera, la más visible). */
export function layoutSites(projects: readonly ProjectRef[]): ProjectSite[] {
  const sorted = [...projects].sort((a, b) => a.projektnummer.localeCompare(b.projektnummer) || a.projektId.localeCompare(b.projektId));
  const ids = projectTeamIds(sorted);
  const places = placeSites(sorted.length);
  return sorted.flatMap((p, i) => {
    const place = places[i];
    if (!place) return [];
    const { position, out, angle, road } = place;
    const side: Point = { x: -out.z, z: out.x };
    return [{
      ...p,
      id: projectSiteId(p.projektId),
      position,
      angle,
      road,
      agents: ids.get(p.projektId) ?? projectAgentIds(p.projektnummer),
      offices: { pl: add(add(position, side, -3.6), out, -1.6), bl: add(add(position, side, 3.6), out, -1.6) },
      building: add(position, out, 0.8),
    }];
  });
}
