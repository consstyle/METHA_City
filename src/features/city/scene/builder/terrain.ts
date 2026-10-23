import * as THREE from 'three';
import { FLOWER_BED, GREENS, hiddenByRoads, PLAZAS, TREES } from '@/features/city/model/landscape';
import { CAMPUS_STREETS, distanceToSegment, ROAD_HALF, roadSegments, type Point } from '@/features/city/model/streets';
import { ellipsePoints, type SceneBuilder } from './builder';
import { ORANGE } from './materials';
import { buildLamps, buildStreet } from './streetBuild';

/** Calles de las obras (de la puerta de AVOR a cada plataforma): el paisaje que pisan no se dibuja. */
export type SiteRoads = readonly (readonly Point[])[];

/** Holgura de una farola respecto a la calzada de una calle de obra. */
const LAMP_CLEARANCE = 0.25;

/**
 * Isla, borde, calles directas desde AVOR (F5c), plazas, zonas verdes, árboles y farolas.
 * Sin anillo vial ni avenidas: cada calle va de AVOR a un edificio, así se ve de dónde sale y adónde
 * va cada camión. Las plantas que pisaría una calle de obra se omiten (sin jardines en las calles).
 */
export function buildTerrain(b: SceneBuilder, siteRoads: SiteRoads = []): void {
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

  const roads = siteRoads.flatMap(roadSegments);
  const hidden = hiddenByRoads(siteRoads);
  // Una farola en el camino de una calle de obra tampoco se pone.
  const lampFree = (p: Point) => roads.every(([a, c]) => distanceToSegment(p, a, c) >= ROAD_HALF + LAMP_CLEARANCE);
  for (const s of CAMPUS_STREETS) {
    buildStreet(b, s.from, s.to);
    buildLamps(b, s.from, s.to, lampFree);
  }

  // Plazas circulares de las cabeceras (la de AVOR es el nudo de las calles) y zonas ajardinadas.
  for (const [x, z, r] of PLAZAS) b.cylinder(x, 0.06, z, r, 0.12, M.paving, 64);
  const [bx, bz] = FLOWER_BED;
  if (!hidden('bed', 0)) {
    for (let i = 0; i < 3; i++) b.cylinder(bx - 0.25 + i * 0.25, 0.04, bz - 0.45 + i * 0.45, 1.6 - i * 0.22, 0.12, M.soil, 40);
  }
  GREENS.forEach(([x, z, rx, rz], i) => {
    if (!hidden('green', i)) b.cylinder(x, 0.04, z, rx, 0.12, M.soil, 32, rx, rz / rx);
  });

  const tree = (x: number, z: number, s: number, crown: THREE.Material) => {
    b.cylinder(x, 0.42 * s, z, 0.07 * s, 0.85 * s, M.bark, 6);
    b.shape('ico|1', () => new THREE.IcosahedronGeometry(1, 1), crown, [x, 0.95 * s, z], [0.44 * s, 0.44 * s * 1.35, 0.44 * s]);
  };
  TREES.forEach(([x, z], i) => {
    // Los sorteos se hacen siempre, así la semilla reparte igual las ventanas de los edificios.
    const s = 0.8 + b.rnd() * 0.4;
    const crown = b.rnd() > 0.5 ? M.green : M.green2;
    if (!hidden('tree', i)) tree(x, z, s, crown);
  });
}
