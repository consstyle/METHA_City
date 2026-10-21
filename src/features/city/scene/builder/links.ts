import * as THREE from 'three';
import { unitById } from '@/features/city/model/hierarchy';
import type { RelationDef, UnitDef } from '@/features/city/model/types';
import { curve, type Point3, type SceneBuilder } from './builder';
import { ORANGE } from './materials';

/** Trazado de la pasarela elevada de coordinación entre Produktion / AVOR y Bauleitung. */
const BRIDGE: readonly Point3[] = [[-3.5, 1.4, -0.15], [0.2, 1.4, 0.2], [5.5, 1.4, 0.6], [10.9, 1.4, 1]];
const COORDINATION_ROUTE: readonly Point3[] = [[-3.5, 2.08, -0.15], [1, 2.08, 0.2], [6, 2.08, 0.6], [10.9, 2.08, 1]];
const COORD_COLOR = 0xe3d8bd;

/** Pasarela elevada (separada de las rutas naranjas de dependencia). */
export function buildBridge(b: SceneBuilder): void {
  const { M } = b;
  const path = curve(BRIDGE);
  b.ribbon(path, 0.65, M.darkSteel);
  b.ribbon(path, 0.09, M.coord, 0.035);
  for (let i = 0; i <= 8; i++) {
    const p = path.getPoint(i / 8);
    b.box(p.x, 0.65, p.z, 0.09, 1.3, 0.09, M.steel);
    b.box(p.x, 1.64, p.z - 0.32, 0.035, 0.5, 0.035, M.steel);
    b.box(p.x, 1.64, p.z + 0.32, 0.035, 0.5, 0.035, M.steel);
  }
  b.line([[-3.5, 1.9, -0.47], [0.2, 1.9, -0.12], [5.5, 1.9, 0.28], [10.9, 1.9, 0.68]], 0x8e9698, 0.022);
  b.line([[-3.5, 1.9, 0.17], [0.2, 1.9, 0.52], [5.5, 1.9, 0.92], [10.9, 1.9, 1.32]], 0x8e9698, 0.022);
}

export interface RouteAnimation {
  readonly curve: THREE.CatmullRomCurve3;
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
    const c = b.line(coord ? COORDINATION_ROUTE : hierarchyPoints(from, to), coord ? COORD_COLOR : ORANGE, coord ? 0.035 : 0.045, group);
    const dots = Array.from({ length: coord ? 4 : 2 }, () => {
      const q = new THREE.Mesh(new THREE.SphereGeometry(coord ? 0.1 : 0.085, 8, 6), coord ? b.M.coord : b.M.warm);
      group.add(q);
      return q;
    });
    return [{ curve: c, dots, relation }];
  });
  return { group, animations };
}

/** Posición de cada punto de una ruta en el instante `clock` (preview.html `animate`). */
export function dotProgress(clock: number, dotIndex: number, dotCount: number, routeIndex: number, coordination: boolean): number {
  const f = (clock + dotIndex / dotCount + routeIndex * 0.17) % 1;
  return coordination && dotIndex % 2 ? 1 - f : f;
}
