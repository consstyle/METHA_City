import type * as THREE from 'three';
import { hiddenByRoads, PARKED, PARKING_LOT } from '@/features/city/model/landscape';
import type { SceneBuilder } from './builder';
import type { SiteRoads } from './terrain';

/** Vehículo aparcado (coche o camión de caja de preview.html), instanciado: no se mueve. */
function parkedVehicle(b: SceneBuilder, x: number, z: number, ry = 0, truck = false, material?: THREE.Material): void {
  const { M } = b;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const part = (w: number, h: number, d: number, m: THREE.Material, px: number, py: number, pz: number) =>
    b.box(x + px * cos + pz * sin, 0.14 + py, z - px * sin + pz * cos, w, h, d, m, ry);
  part(0.43, 0.24, truck ? 1.15 : 0.82, material ?? M.white, 0, 0.24, 0);
  part(0.35, 0.23, 0.36, M.glass, 0, 0.45, truck ? 0.35 : 0.08);
  if (truck) part(0.45, 0.47, 0.66, M.white, 0, 0.4, -0.2);
  for (const xx of [-0.23, 0.23]) for (const zz of [-0.28, 0.28]) part(0.07, 0.15, 0.15, M.black, xx, 0.11, zz);
  part(0.32, 0.05, 0.015, M.warm, 0, 0.26, truck ? 0.58 : 0.42);
}

/**
 * Vehículos aparcados y marcas del aparcamiento (landscape.ts). Sin tráfico de adorno: lo único que
 * circula son los camiones de TS, para que se vea bien de dónde salen y adónde van (F5c).
 * Lo que pisaría una calle de obra no se dibuja.
 */
export function buildParking(b: SceneBuilder, siteRoads: SiteRoads = []): void {
  const { M } = b;
  const hidden = hiddenByRoads(siteRoads);
  PARKED.forEach((v, i) => {
    if (!hidden('parked', i)) parkedVehicle(b, v.x, v.z, v.ry, v.truck, v.orange ? M.orange : undefined);
  });
  for (let i = 0; i < PARKING_LOT.count; i++) {
    if (!hidden('lot', i)) b.box(PARKING_LOT.x, 0.16, PARKING_LOT.z + i * PARKING_LOT.step, 0.8, 0.015, 0.04, M.paint);
  }
}
