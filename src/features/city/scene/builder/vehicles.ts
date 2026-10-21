import * as THREE from 'three';
import type { SceneBuilder } from './builder';

/** Coche o camión de caja (preview.html `vehicle`). */
export function vehicle(b: SceneBuilder, x: number, z: number, ry = 0, truck = false, material?: THREE.Material): THREE.Group {
  const { M, boxGeo } = b;
  const g = new THREE.Group();
  g.position.set(x, 0.14, z);
  g.rotation.y = ry;
  const part = (w: number, h: number, d: number, m: THREE.Material, px: number, py: number, pz: number) => {
    const q = new THREE.Mesh(boxGeo, m);
    q.scale.set(w, h, d);
    q.position.set(px, py, pz);
    q.castShadow = true;
    g.add(q);
  };
  part(0.43, 0.24, truck ? 1.15 : 0.82, material ?? M.white, 0, 0.24, 0);
  part(0.35, 0.23, 0.36, M.glass, 0, 0.45, truck ? 0.35 : 0.08);
  if (truck) part(0.45, 0.47, 0.66, M.white, 0, 0.4, -0.2);
  for (const xx of [-0.23, 0.23]) for (const zz of [-0.28, 0.28]) part(0.07, 0.15, 0.15, M.black, xx, 0.11, zz);
  part(0.32, 0.05, 0.015, M.warm, 0, 0.26, truck ? 0.58 : 0.42);
  b.root.add(g);
  return g;
}

/** Vehículo aparcado: mismas piezas que `vehicle`, pero instanciadas (no se mueve). */
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

/** Vehículos aparcados y marcas de aparcamiento. */
export function buildParking(b: SceneBuilder): void {
  const { M } = b;
  parkedVehicle(b, -17.4, 6.6, -Math.PI / 2, true);
  parkedVehicle(b, -13.6, 6.4, -Math.PI / 2);
  parkedVehicle(b, -4.2, -7.1, 0, true);
  parkedVehicle(b, -2.7, -7.1, 0, true);
  parkedVehicle(b, 16.2, 1.5, 0);
  parkedVehicle(b, 16.2, 2.6, 0, false, M.orange);
  parkedVehicle(b, 9.8, -4.8, Math.PI / 2);
  parkedVehicle(b, 8.6, -4.8, Math.PI / 2);
  for (let i = 0; i < 6; i++) b.box(16.7, 0.16, -0.5 + i * 0.77, 0.8, 0.015, 0.04, M.paint);
  for (let i = 0; i < 8; i++) {
    b.box(6.1 + i * 0.22, 0.1, -3.2, 0.11, 0.01, 0.85, M.paint);
    b.box(-18.7 + i * 0.22, 0.1, -1, 0.11, 0.01, 0.85, M.paint);
  }
}

/** Tráfico del anillo vial: no proyecta sombra (las sombras son estáticas). */
export function buildTraffic(b: SceneBuilder): THREE.Group[] {
  const cars = [vehicle(b, 0, 0, 0, false, b.M.orange), vehicle(b, 0, 0), vehicle(b, 0, 0, 0, true)];
  cars.forEach((c) => c.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  }));
  return cars;
}
