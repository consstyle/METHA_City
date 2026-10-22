import { ISLAND, RING_ROAD, wobblyEllipsePoint } from './island';

/**
 * Obras de los proyectos (F5c, D26–D27): cada proyecto activo de MethaDesk es una obra en su propia
 * plataforma alrededor de la isla, unida al anillo vial por una carretera, con su Projektleitung y
 * su Bauleitung. Funciones puras: la posición sale solo de la lista de proyectos.
 */

export interface ProjectRef {
  readonly projektId: string;
  readonly projektnummer: string;
  readonly projektname: string;
}

export interface Point {
  readonly x: number;
  readonly z: number;
}

export interface ProjectSite extends ProjectRef {
  /** Id seleccionable en la ciudad (`projekt:<projektId>`). */
  readonly id: string;
  /** Centro de la plataforma. */
  readonly position: Point;
  /** Ángulo alrededor de la isla (radianes). */
  readonly angle: number;
  /** Carretera: del anillo vial al borde de la plataforma. */
  readonly road: readonly [Point, Point];
  /** Agentes del proyecto (D28). */
  readonly agents: { readonly pl: string; readonly bl: string };
  /** Posición de las oficinas de obra y de la obra dentro de la plataforma. */
  readonly offices: { readonly pl: Point; readonly bl: Point };
  readonly building: Point;
}

/** Tamaño de la plataforma de una obra (ancho a lo largo del anillo, fondo hacia fuera). */
export const SITE_PLATFORM = { w: 11, d: 8 } as const;
/** Distancia mínima entre el borde de la isla y el de una plataforma. */
const GAP = 4.5;
/** Hueco entre plataformas vecinas a lo largo del anillo de obras. */
const SPACING = SITE_PLATFORM.w + 2;
/** Primera obra al sur-este (hacia la cámara), el resto en sentido horario. */
const START_ANGLE = Math.PI * 0.32;

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

const SAMPLES = 720;

/** Centro de plataforma en el ángulo dado, a `offset` del borde de la isla, y su dirección hacia fuera. */
function placement(angle: number, offset: number): { center: Point; out: Point; edge: Point } {
  const edge = wobblyEllipsePoint(ISLAND.rx, ISLAND.rz, angle);
  const len = Math.hypot(edge.x, edge.z) || 1;
  const out: Point = { x: edge.x / len, z: edge.z / len };
  return { center: add(edge, out, offset), out, edge };
}

/**
 * Ángulos de las obras repartidas a igual distancia a lo largo de su anillo. Si no caben, el anillo
 * se aleja de la isla (más perímetro) hasta que caben con SPACING entre vecinas.
 */
function siteAngles(n: number): { angles: number[]; offset: number } {
  for (let offset = GAP + SITE_PLATFORM.d / 2; ; offset += 2) {
    const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => placement(START_ANGLE + (i / SAMPLES) * Math.PI * 2, offset).center);
    // Longitud acumulada a lo largo del anillo (bucle local: O(n), sin copiar el array en cada paso).
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
    const total = cum.at(-1) ?? 0;
    if (n * SPACING > total && offset < 400) continue;
    const angles = Array.from({ length: n }, (_, k) => {
      const target = (k / n) * total;
      const i = cum.findIndex((c) => c >= target);
      return START_ANGLE + (Math.max(0, i) / SAMPLES) * Math.PI * 2;
    });
    return { angles, offset };
  }
}

export function layoutSites(projects: readonly ProjectRef[]): ProjectSite[] {
  const sorted = [...projects].sort((a, b) => a.projektnummer.localeCompare(b.projektnummer) || a.projektId.localeCompare(b.projektId));
  const ids = projectTeamIds(sorted);
  const { angles, offset } = siteAngles(sorted.length);
  return sorted.map((p, i) => {
    const angle = angles[i] ?? START_ANGLE;
    const { center: position, out } = placement(angle, offset);
    const side: Point = { x: -out.z, z: out.x };
    const ring = wobblyEllipsePoint(RING_ROAD.rx, RING_ROAD.rz, angle);
    const front = add(position, out, -SITE_PLATFORM.d / 2);
    return {
      ...p,
      id: projectSiteId(p.projektId),
      position,
      angle,
      road: [ring, front],
      agents: ids.get(p.projektId) ?? projectAgentIds(p.projektnummer),
      offices: { pl: add(add(position, side, -3.6), out, -1.6), bl: add(add(position, side, 3.6), out, -1.6) },
      building: add(position, out, 0.8),
    };
  });
}
