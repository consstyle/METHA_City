import * as THREE from 'three';
import { curve, ellipsePoints, type Point3, type SceneBuilder } from './builder';
import { ORANGE } from './materials';

export const AVENUES: readonly (readonly Point3[])[] = [
  [[-20, 0.06, -1], [-14, 0.06, -1], [-7, 0.06, -5], [0, 0.06, -4], [5, 0.06, -1], [18, 0.06, 5]],
  [[2, 0.065, -13], [3, 0.065, -7], [4, 0.065, 0], [2, 0.065, 7], [0, 0.065, 14]],
  [[-20, 0.06, 8], [-14, 0.06, 8], [-9, 0.06, 5], [-1, 0.06, 5], [7, 0.06, 6], [15, 0.06, 10]],
];

export const TREES: readonly (readonly [number, number])[] = [
  [18, -7], [18.2, -5.5], [17.8, -4], [-10, -11.8], [-11.2, -11.5], [-12.3, -12], [-18.5, 9.4], [-17.3, 9.8],
  [4.6, 10.8], [5.5, 11.4], [-1.8, 9.4], [-1.3, 10.5], [6, -2], [6.5, -0.8], [6.2, 0.3], [-11, 5.7], [-10.1, 5.4], [-1, -5.8],
];

/** Plazas de las cabeceras: x, z, radio. */
export const PLAZAS: readonly (readonly [number, number, number])[] = [[-6, -1, 4], [8.5, -8, 3.5]];
/** Zonas ajardinadas: x, z, radio x, radio z. */
export const GREENS: readonly (readonly [number, number, number, number])[] = [
  [-11, -11.7, 2.2, 1.05], [-18, 9.6, 1.7, 1], [18, -6, 1.8, 3], [5, 11, 1.6, 1.25], [-1.6, 10, 1.1, 1.6],
];

/** Isla, borde, anillo vial, avenidas, plazas, zonas verdes, árboles y farolas (orden de preview.html). */
export function buildTerrain(b: SceneBuilder): { ringPath: THREE.CatmullRomCurve3 } {
  const { M } = b;
  const perimeter = ellipsePoints(24.4, 16.3, 0);
  const shape = new THREE.Shape();
  perimeter.forEach((p, i) => (i ? shape.lineTo(p[0], -p[2]) : shape.moveTo(p[0], -p[2])));
  const island = b.mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.25, bevelSegments: 3, steps: 1 }),
    [M.base, M.edge], 0, -1.42, 0,
  );
  island.rotation.x = -Math.PI / 2;
  const floor = b.mesh(new THREE.PlaneGeometry(200, 200), M.floor, 0, -1.85, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;

  b.line(ellipsePoints(24.85, 16.75, -0.53), ORANGE, 0.035);
  b.line(ellipsePoints(24.6, 16.5, -1.03), 0x69767b, 0.018);
  const ringPath = curve(ellipsePoints(22.3, 14.4, 0.05));
  b.ribbon(ringPath, 1.8, M.road);
  b.ribbon(curve(ellipsePoints(23.3, 15.05, 0.07)), 0.1, M.curb);
  b.ribbon(curve(ellipsePoints(21.2, 13.7, 0.07)), 0.1, M.curb);
  for (let i = 0; i < 112; i++) {
    const p = ringPath.getPoint(i / 112);
    const v = ringPath.getTangent(i / 112);
    b.box(p.x, 0.072, p.z, 0.06, 0.015, 0.31, M.paint, Math.atan2(v.x, v.z));
  }
  for (const points of AVENUES) {
    const c = curve(points);
    b.ribbon(c, 1.4, M.road);
    for (let i = 0; i < 32; i++) {
      const p = c.getPoint(i / 32);
      const v = c.getTangent(i / 32);
      b.box(p.x, 0.085, p.z, 0.045, 0.015, 0.22, M.paint, Math.atan2(v.x, v.z));
    }
  }

  // Plazas circulares en las dos cabeceras y zonas ajardinadas irregulares
  for (const [x, z, r] of PLAZAS) b.cylinder(x, 0.06, z, r, 0.12, M.paving, 64);
  for (let i = 0; i < 3; i++) b.cylinder(3 + i * 0.25, 0.04, 6 + i * 0.45, 1.6 - i * 0.22, 0.12, M.soil, 40);
  for (const [x, z, rx, rz] of GREENS) b.cylinder(x, 0.04, z, rx, 0.12, M.soil, 32, rx, rz / rx);

  const tree = (x: number, z: number, s: number) => {
    b.cylinder(x, 0.42 * s, z, 0.07 * s, 0.85 * s, M.bark, 6);
    const crown = b.rnd() > 0.5 ? M.green : M.green2;
    b.shape('ico|1', () => new THREE.IcosahedronGeometry(1, 1), crown, [x, 0.95 * s, z], [0.44 * s, 0.44 * s * 1.35, 0.44 * s]);
  };
  TREES.forEach(([x, z]) => tree(x, z, 0.8 + b.rnd() * 0.4));

  for (let i = 0; i < 31; i++) {
    const p = ringPath.getPoint((i + 0.3) / 31);
    const x = p.x * 0.94;
    const z = p.z * 0.94;
    b.cylinder(x, 0.6, z, 0.025, 1.2, M.darkSteel, 6);
    b.box(x, 1.21, z, 0.35, 0.045, 0.14, M.steel);
    b.box(x, 1.18, z, 0.27, 0.02, 0.1, M.warm);
  }
  return { ringPath };
}
