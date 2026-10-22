import * as THREE from 'three';
import { unitById } from '@/features/city/model/hierarchy';
import type { RelationDef, UnitDef } from '@/features/city/model/types';
import type { Point3, SceneBuilder } from './builder';
import { ORANGE } from './materials';

const COORD_COLOR = 0xe3d8bd;

/** Ruta de coordinación elevada entre dos unidades (arco sobre la línea recta que las une). */
function coordinationPoints(a: UnitDef, c: UnitDef): Point3[] {
  const at = (t: number, y: number): Point3 => [
    a.position.x + (c.position.x - a.position.x) * t, y, a.position.z + (c.position.z - a.position.z) * t,
  ];
  return [at(0.15, 1.6), at(0.4, 2.1), at(0.6, 2.1), at(0.85, 1.6)];
}

export interface RouteAnimation {
  readonly curve: THREE.CatmullRomCurve3;
  /** Tubo de la ruta (se ilumina cuando hay una delegación activa por ella). */
  readonly tube: THREE.Mesh;
  readonly dots: readonly THREE.Mesh[];
  readonly relation: RelationDef;
}

function hierarchyPoints(a: UnitDef, c: UnitDef): Point3[] {
  const vx = c.position.x - a.position.x;
  const vz = c.position.z - a.position.z;
  const l = Math.hypot(vx, vz);
  const ux = vx / l;
  const uz = vz / l;
  const ar = Math.min(a.size.w, a.size.d) * 0.6;
  const br = Math.min(c.size.w, c.size.d) * 0.6;
  return [
    [a.position.x + ux * ar, 0.4, a.position.z + uz * ar],
    [a.position.x + vx * 0.36, 0.5, a.position.z + vz * 0.36 - 0.6],
    [a.position.x + vx * 0.72, 0.5, a.position.z + vz * 0.72 - 0.4],
    [c.position.x - ux * br, 0.4, c.position.z - uz * br],
  ];
}

/** Rutas de dependencia (naranja) y de coordinación (crema) con sus puntos animados. */
export function buildRoutes(b: SceneBuilder, units: readonly UnitDef[], relations: readonly RelationDef[]) {
  const group = new THREE.Group();
  b.root.add(group);
  const animations: RouteAnimation[] = relations.flatMap((relation) => {
    const from = unitById(units, relation.from);
    const to = unitById(units, relation.to);
    if (!from || !to) return [];
    const coord = relation.kind === 'coordination';
    const c = b.line(coord ? coordinationPoints(from, to) : hierarchyPoints(from, to), coord ? COORD_COLOR : ORANGE, coord ? 0.035 : 0.045, group);
    const tube = group.children[group.children.length - 1] as THREE.Mesh;
    const dots = Array.from({ length: coord ? 4 : 2 }, () => {
      const q = new THREE.Mesh(new THREE.SphereGeometry(coord ? 0.1 : 0.085, 8, 6), coord ? b.M.coord : b.M.warm);
      group.add(q);
      return q;
    });
    return [{ curve: c, tube, dots, relation }];
  });
  return { group, animations };
}

/** true si la ruta corresponde a alguna delegación activa (en cualquier sentido si es de coordinación). */
export function isRouteActive(relation: RelationDef, delegations: readonly { from: string; to: string | null }[]): boolean {
  return delegations.some(
    (d) => (d.from === relation.from && d.to === relation.to)
      || (relation.kind === 'coordination' && d.from === relation.to && d.to === relation.from),
  );
}

/** Posición de cada punto de una ruta en el instante `clock` (preview.html `animate`). */
export function dotProgress(clock: number, dotIndex: number, dotCount: number, routeIndex: number, coordination: boolean): number {
  const f = (clock + dotIndex / dotCount + routeIndex * 0.17) % 1;
  return coordination && dotIndex % 2 ? 1 - f : f;
}
