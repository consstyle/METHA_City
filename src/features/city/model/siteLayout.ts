import { fitFactor, siteFitPoints } from './viewFit';
import { insideIsland, islandExit, ISLAND, wobblyEllipsePoint } from './island';
import { isRemovable, LANDSCAPE_OBSTACLES, ROAD_CLEARANCE } from './landscape';
import { PAVILION_LOTS } from './specialists';
import {
  angleGap, bearing, CAMPUS_STREETS, distanceToSegment, doorToward, hubUnit, ROAD_HALF, roadSegments, samplesAlong, streetClearance, type Point,
} from './streets';

/**
 * Dónde va cada obra (F5c): alrededor de la isla, en el sitio más visible de la vista inicial
 * donde su calle recta desde AVOR no pise edificios, jardines, árboles, aparcamientos, solares de
 * pabellón ni otras calles u obras. Si ya no queda dirección libre (muchos proyectos), la obra
 * cuelga de la calle de otra con un ramal por fuera de la isla, o se pone en fila detrás de una obra
 * de la costa. Determinista.
 */

/** Plataforma de una obra: ancho a lo largo de su frente, fondo hacia fuera. */
export const SITE_PLATFORM = { w: 11, d: 8 } as const;
/** Radio que cubre la plataforma entera (media diagonal). */
export const SITE_RADIUS = Math.hypot(SITE_PLATFORM.w / 2, SITE_PLATFORM.d / 2);

/** Distancia del borde de la isla al centro de la plataforma en el primer intento, y paso hacia fuera. */
const FIRST_OFFSET = 3.5 + SITE_PLATFORM.d / 2;
const OFFSET_STEP = 3;
/** Pasos que cuentan como «cerca de la isla». */
const NEAR_STEPS = 4;
const ANGLES = 144;
/** Holgura entre la calzada y lo que esquiva. */
const MARGIN = ROAD_CLEARANCE;
const LOT_RADIUS = 1.4;
/** Separación angular, vista desde AVOR, con las calles del campus. */
const STREET_GAP = (12 * Math.PI) / 180;
/** El ramal sale del tramo sobre pilares, este trecho por fuera del borde de la isla. */
const SPUR_START = 0.9;

/**
 * Reglas de las calles directas, de más a menos exigente: separación entre calles de obra y si la
 * calle puede pasar por donde hay plantas o coches aparcados (que entonces no se dibujan).
 */
const RULES = [
  { siteRoadGap: (8 * Math.PI) / 180, crossLandscape: false },
  { siteRoadGap: (4 * Math.PI) / 180, crossLandscape: false },
  { siteRoadGap: (8 * Math.PI) / 180, crossLandscape: true },
  { siteRoadGap: (4 * Math.PI) / 180, crossLandscape: true },
] as const;
type Rules = (typeof RULES)[number];

export interface Placement {
  readonly angle: number;
  /** Centro de la plataforma. */
  readonly position: Point;
  /** Hacia dónde mira la obra (su frente da a la calle que llega). */
  readonly out: Point;
  /** Calle: de la puerta de AVOR al borde de la plataforma (2 puntos; más si sigue la calle de otra obra). */
  readonly road: readonly Point[];
}

const add = (p: Point, d: Point, k: number): Point => ({ x: p.x + d.x * k, z: p.z + d.z * k });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (from: Point, to: Point): Point => {
  const l = dist(from, to) || 1;
  return { x: (to.x - from.x) / l, z: (to.z - from.z) / l };
};

/** Centro de plataforma a `offset` del borde de la isla en el ángulo dado. */
function siteCenter(angle: number, offset: number): Point {
  const edge = wobblyEllipsePoint(ISLAND.rx, ISLAND.rz, angle);
  const radial = Math.hypot(edge.x, edge.z) || 1;
  return add(edge, { x: edge.x / radial, z: edge.z / radial }, offset);
}

/** Obra cuyo frente mira hacia `from` y cuya calle llega desde ahí. */
function facing(angle: number, position: Point, from: Point, roadHead: readonly Point[]): Placement {
  const out = unit(from, position);
  return { angle, position, out, road: [...roadHead, add(position, out, -SITE_PLATFORM.d / 2)] };
}

function directAt(angle: number, offset: number): Placement {
  const hub = hubUnit();
  const position = siteCenter(angle, offset);
  const front = add(position, unit(hub.position, position), -SITE_PLATFORM.d / 2);
  return facing(angle, position, hub.position, [doorToward(hub, front)]);
}

/** Distancia de un punto a la plataforma (rectángulo girado); 0 si cae dentro. */
function platformDistance(q: Point, p: Placement): number {
  const rel = { x: q.x - p.position.x, z: q.z - p.position.z };
  const along = Math.abs(rel.x * p.out.x + rel.z * p.out.z) - SITE_PLATFORM.d / 2;
  const across = Math.abs(rel.x * -p.out.z + rel.z * p.out.x) - SITE_PLATFORM.w / 2;
  return Math.hypot(Math.max(along, 0), Math.max(across, 0));
}

function corners(p: Placement): Point[] {
  const side = { x: -p.out.z, z: p.out.x };
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([s, o]) =>
    add(add(p.position, side, (s! * SITE_PLATFORM.w) / 2), p.out, (o! * SITE_PLATFORM.d) / 2));
}

/** Distancia mínima entre una calle y una plataforma ajena. */
const roadToPlatform = (road: readonly Point[], p: Placement) =>
  Math.min(...roadSegments(road).flatMap(([a, b]) => samplesAlong(a, b, 0.4).map((q) => platformDistance(q, p))));

/** Lo común a cualquier obra: no se solapa, queda fuera de la isla y deja paso a las otras calles. */
function freeSpot(p: Placement, chosen: readonly Placement[], ownRoad: readonly Point[] = p.road): boolean {
  if (chosen.some((c) => dist(c.position, p.position) < 2 * SITE_RADIUS + 1)) return false;
  if (corners(p).some((q) => insideIsland(q, -1))) return false;
  const clearance = ROAD_HALF + MARGIN;
  return chosen.every((c) => roadToPlatform(ownRoad, c) >= clearance && roadToPlatform(c.road, p) >= clearance);
}

/** Calle directa: separada de las otras calles y sin pisar edificios, solares ni (según la regla) paisaje. */
function fitsDirect(p: Placement, chosen: readonly Placement[], { siteRoadGap, crossLandscape }: Rules): boolean {
  const [a, b] = [p.road[0]!, p.road[1]!];
  const heading = bearing({ from: a, to: b });
  if (CAMPUS_STREETS.some((s) => angleGap(bearing(s), heading) < STREET_GAP)) return false;
  if (chosen.some((c) => angleGap(bearing({ from: c.road[0]!, to: c.road[1]! }), heading) < siteRoadGap)) return false;
  const blocking = LANDSCAPE_OBSTACLES.filter((o) => !crossLandscape || !isRemovable(o));
  if (blocking.some((o) => distanceToSegment(o, a, b) < o.r + ROAD_HALF + MARGIN)) return false;
  if (PAVILION_LOTS.some((l) => distanceToSegment(l, a, b) < LOT_RADIUS + ROAD_HALF + MARGIN)) return false;
  if (!freeSpot(p, chosen)) return false;
  return streetClearance(a, b, [hubUnit().id]) >= ROAD_HALF + MARGIN;
}

/** Cruce estricto de dos segmentos (compartir un extremo no cuenta). */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Ramal: va por fuera de la isla y no corta las calles de las otras obras. */
function fitsSpur(p: Placement, chosen: readonly Placement[], parent: Placement): boolean {
  const [junction, front] = [p.road[1]!, p.road[2]!];
  if (samplesAlong(junction, front, 0.4).some((q) => insideIsland(q, -(ROAD_HALF + 0.1)))) return false;
  if (chosen.some((c) => c !== parent && roadSegments(c.road).some(([a, b]) => crosses(a, b, junction, front)))) return false;
  // El tramo hasta el empalme es la calle de la otra obra, ya comprobada: aquí basta el ramal.
  return freeSpot(p, chosen, [junction, front]);
}

/** Cuánto habría que abrir el encuadre inicial para ver la obra entera (menos = más visible). */
const visibility = (p: Placement) => Math.max(...siteFitPoints(p.position).map((q) => fitFactor(q)));

/** La más visible de las candidatas que cumplen `ok`. */
function best<T extends { readonly p: Placement }>(candidates: readonly T[], ok: (c: T) => boolean): Placement | null {
  let found: Placement | null = null;
  let score = Infinity;
  for (const c of candidates) {
    if (!ok(c)) continue;
    const s = visibility(c.p);
    if (s < score) {
      found = c.p;
      score = s;
    }
  }
  return found;
}

const anglesAround = () => Array.from({ length: ANGLES }, (_, i) => (i / ANGLES) * Math.PI * 2 - Math.PI);

const directCandidates = (offset: number) => anglesAround().map((a) => ({ p: directAt(a, offset) }));

/** Obras que cuelgan de la calle directa de otra: el ramal sale de su tramo sobre pilares. */
function spurCandidates(offset: number, chosen: readonly Placement[]) {
  return chosen.filter((c) => c.road.length === 2).flatMap((parent) => {
    const junction = junctionOf(parent);
    return anglesAround().map((angle) => ({ p: facing(angle, siteCenter(angle, offset), junction, [parent.road[0]!, junction]), parent }));
  });
}

/** Cerca de la isla: calle directa (de la regla más exigente a la menos) o ramal; null si ya no cabe. */
function placeNear(chosen: readonly Placement[]): Placement | null {
  const near = Array.from({ length: NEAR_STEPS + 1 }, (_, k) => FIRST_OFFSET + k * OFFSET_STEP);
  for (const rules of RULES) {
    for (const offset of near) {
      const p = best(directCandidates(offset), (c) => fitsDirect(c.p, chosen, rules));
      if (p) return p;
    }
  }
  for (const offset of near) {
    const p = best(spurCandidates(offset, chosen), (c) => fitsSpur(c.p, chosen, c.parent));
    if (p) return p;
  }
  return null;
}

/**
 * Empalme sobre el tablero de la calle directa de `parent`: el ramal sale justo fuera de la isla; una
 * fila, a mitad del tablero (más lejos de la isla, sin acercarse demasiado a la plataforma).
 */
function junctionOf(parent: Placement, middle = false): Point {
  const [a, b] = [parent.road[0]!, parent.road[1]!];
  const exit = islandExit(a, b) * dist(a, b);
  const deck = dist(a, b) - exit;
  const along = middle ? Math.min(deck - (ROAD_HALF + MARGIN + 0.1), Math.max(SPUR_START, deck / 2)) : SPUR_START;
  return add(a, unit(a, b), exit + along);
}

/** Hueco entre obras seguidas de una fila y separación lateral de su calle respecto al eje. */
const ROW_GAP = 4;
const ROW_SIDE = SITE_PLATFORM.w / 2 + ROAD_HALF + MARGIN + 0.3;

/**
 * Obra número `k` (1, 2, …) de la fila detrás de `parent`, en su mismo eje. La calle continúa la
 * de `parent`: desde el empalme se aparta a un lado, pasa junto a las plataformas de delante y
 * entra en la obra por el hueco que la separa de la anterior.
 */
function rowMember(parent: Placement, k: number, side: 1 | -1): Placement {
  const lateral = { x: -parent.out.z * side, z: parent.out.x * side };
  const position = add(parent.position, parent.out, k * (SITE_PLATFORM.d + ROW_GAP));
  const front = add(position, parent.out, -SITE_PLATFORM.d / 2);
  const junction = junctionOf(parent, true);
  const turn = add(junction, lateral, ROW_SIDE);
  const road = [parent.road[0]!, junction, turn, add(add(front, parent.out, -1.5), lateral, ROW_SIDE), front];
  return { angle: parent.angle, position, out: parent.out, road };
}

/** true si la calle propia (desde el empalme) va entera por fuera de la isla. */
const offIsland = (p: Placement) =>
  roadSegments(p.road.slice(1)).every(([a, b]) => samplesAlong(a, b, 0.4).every((q) => !insideIsland(q, -(ROAD_HALF + 0.1))));

/** La calle propia de una obra de fila (desde el empalme) va por fuera de la isla y no corta otras. */
function fitsRow(p: Placement, chosen: readonly Placement[], parent: Placement): boolean {
  const own = p.road.slice(1);
  if (!offIsland(p)) return false;
  const others = chosen.filter((c) => c !== parent && c.road[1] !== p.road[1]);
  if (others.some((c) => roadSegments(c.road).some(([a, b]) => roadSegments(own).some(([c1, d1]) => crosses(a, b, c1, d1))))) return false;
  return freeSpot(p, chosen, own);
}

/** Ninguna plataforma encima de otra (lo mínimo, también en el último recurso). */
const apart = (p: Placement, chosen: readonly Placement[]) => chosen.every((c) => dist(c.position, p.position) >= 2 * SITE_RADIUS + 1);

/**
 * Cuando la costa está llena (muchos proyectos): filas detrás de las obras de la costa. Cada obra
 * nueva va a la fila más corta donde quepa sin pisar otras obras ni cortar calles. Si no cabe en
 * ninguna, a la fila más corta, más atrás hasta que no se solape con nada.
 */
function overflowOne(chosen: readonly Placement[], coast: readonly Placement[], rows: ReadonlyMap<Placement, number>) {
  const parents = coast.filter((c) => c.road.length === 2).sort((a, b) => (rows.get(a) ?? 0) - (rows.get(b) ?? 0));
  for (const parent of parents) {
    for (const side of [1, -1] as const) {
      const p = rowMember(parent, (rows.get(parent) ?? 0) + 1, side);
      if (fitsRow(p, chosen, parent)) return { p, parent, steps: 1 };
    }
  }
  if (parents.length === 0) return { p: directAt(0, FIRST_OFFSET + (chosen.length + 1) * OFFSET_STEP * 5), parent: null, steps: 0 };
  // Último recurso: más atrás en alguna fila, sin solaparse y por fuera de la isla (o al menos sin solaparse).
  const options = parents.flatMap((parent) => [1, -1].flatMap((side) => {
    const first = (rows.get(parent) ?? 0) + 1;
    return Array.from({ length: 12 }, (_, i) => ({ parent, steps: i + 1, p: rowMember(parent, first + i, side as 1 | -1) }));
  })).sort((x, y) => x.steps - y.steps);
  const pick = options.find((o) => apart(o.p, chosen) && offIsland(o.p)) ?? options.find((o) => apart(o.p, chosen)) ?? options[0]!;
  return pick;
}

/** Sitio de cada una de las `n` obras, en orden (la primera, la más visible). */
export function placeSites(n: number): Placement[] {
  const { coast, overflow } = Array.from({ length: n }).reduce<{ coast: Placement[]; overflow: number; full: boolean }>(
    (acc) => {
      // Si una obra ya no cabe cerca, tampoco cabrán las siguientes (cada obra añade restricciones).
      const p = acc.full ? null : placeNear(acc.coast);
      return p ? { ...acc, coast: [...acc.coast, p] } : { ...acc, overflow: acc.overflow + 1, full: true };
    },
    { coast: [], overflow: 0, full: false },
  );
  const outer = Array.from({ length: overflow }).reduce<{ placed: Placement[]; rows: Map<Placement, number> }>((acc) => {
    const { p, parent, steps } = overflowOne([...coast, ...acc.placed], coast, acc.rows);
    const rows = new Map(acc.rows);
    if (parent) rows.set(parent, (rows.get(parent) ?? 0) + steps);
    return { placed: [...acc.placed, p], rows };
  }, { placed: [], rows: new Map() });
  return [...coast, ...outer.placed];
}
