import type { UnitDef } from '@/features/city/model/types';
import type { SceneBuilder } from '../builder';
import { facade, roofEquipment } from './common';

/** Torre escalonada del núcleo orquestador, con corona naranja, cartel METHABAU y antena. */
export function buildTower(b: SceneBuilder, u: UnitDef): void {
  const { M } = b;
  const { x, z } = u.position;
  const { w, d } = u.size;
  facade(b, x, z, w, d, 2.1, u.id, 0.3);
  facade(b, x + 0.2, z - 0.1, w * 0.72, d * 0.78, 5.5, u.id, 2.45);
  facade(b, x + 0.2, z - 0.1, w * 0.81, d * 0.87, 0.78, u.id, 7.98);
  b.box(x + 0.2, 7.91, z - 0.1, w * 0.83, 0.12, d * 0.9, M.orange);
  b.box(x + 0.2, 8.85, z - 0.1, w * 0.82, 0.12, d * 0.88, M.darkSteel);
  b.box(x + 0.2, 8.88, z - 0.1 + d * 0.44, w * 0.82, 0.045, 0.05, M.orange);
  b.box(x + 0.2, 8.88, z - 0.1 - d * 0.44, w * 0.82, 0.045, 0.05, M.orange);
  b.box(x + 0.2 + w * 0.41, 8.88, z - 0.1, 0.05, 0.045, d * 0.88, M.orange);
  b.box(x + 0.2 - w * 0.41, 8.88, z - 0.1, 0.05, 0.045, d * 0.88, M.orange);
  roofEquipment(b, x + 0.2, z - 0.1, 8.95, 3, 2.7);
  for (const sx of [-1, 1]) {
    b.box(x + sx * w * 0.39, 4.1, z + d * 0.42, 0.12, 7.6, 0.13, M.steel);
    b.box(x + sx * w * 0.39 + 0.04, 4.1, z + d * 0.44, 0.025, 7.6, 0.035, M.orange);
  }
  b.box(x, 1.1, z + d * 0.5 + 0.6, 2.2, 0.14, 1.2, M.steel);
  b.box(x, 1.02, z + d * 0.5 + 1.08, 2.15, 0.04, 0.04, M.orange);
  b.sign('METHABAU', x + 0.2, 8.38, z - 0.1 + d * 0.44 + 0.025, 2.8);
  b.cylinder(x + 0.2, 9.75, z - 0.1, 0.035, 1.1, M.steel, 8);
  b.cylinder(x + 0.2, 10.32, z - 0.1, 0.075, 0.08, M.orange, 10);
}

/** Oficina de fachada de vidrio con cartel, marquesina y equipos de cubierta. */
export function buildOffice(b: SceneBuilder, u: UnitDef): void {
  const { M } = b;
  const { x, z } = u.position;
  const { w, d, h } = u.size;
  facade(b, x, z, w, d, h, u.id, 0.3);
  roofEquipment(b, x, z, h + 0.43, w, d);
  b.box(x - w / 2 - 0.1, h / 2, z, 0.2, h + 0.3, d + 0.25, M.white);
  b.box(x + w / 2 + 0.1, h / 2, z, 0.15, h + 0.3, d + 0.25, M.darkSteel);
  b.box(x, h + 0.23, z + d / 2 + 0.15, w + 0.4, 0.08, 0.06, M.orange);
  b.box(x, 0.9, z + d / 2 + 0.45, 1.8, 0.1, 0.8, M.steel);
  b.sign(u.name.toUpperCase(), x, h - 0.3, z + d / 2 + 0.1, Math.min(w * 0.8, 2.7));
}

/** Edificio escalonado con terrazas verdes (dirección del proyecto). */
export function buildTerrace(b: SceneBuilder, u: UnitDef): void {
  const { M } = b;
  const { x, z } = u.position;
  const { w, d } = u.size;
  facade(b, x, z, w + 1, d + 1, 1.3, u.id, 0.3);
  facade(b, x - 0.2, z - 0.2, w, d, 3.2, u.id, 1.75);
  facade(b, x - 0.3, z - 0.4, w * 0.8, d * 0.8, 1.8, u.id, 5.08);
  b.box(x - 0.3, 6.99, z - 0.4, w * 0.8 + 0.2, 0.12, d * 0.8 + 0.2, M.darkSteel);
  b.box(x - 0.3, 7.01, z - 0.4 + d * 0.4 + 0.1, w * 0.8 + 0.2, 0.05, 0.06, M.orange);
  b.box(x - 0.3, 7.01, z - 0.4 - d * 0.4 - 0.1, w * 0.8 + 0.2, 0.05, 0.06, M.orange);
  roofEquipment(b, x - 0.4, z - 0.4, 7.1, w * 0.6, d * 0.6);
  b.box(x, 1.72, z + d * 0.48, w * 0.95, 0.09, 0.08, M.orange);
  for (let i = 0; i < 4; i++) {
    b.box(x - 1.5 + i * 0.85, 5.08, z + d * 0.47, 0.5, 0.24, 0.38, M.soil);
    b.box(x - 1.5 + i * 0.85, 5.25, z + d * 0.47, 0.43, 0.22, 0.3, M.green);
  }
  b.sign(u.name.toUpperCase(), x, 1.05, z + d * 0.5 + 0.51, 3.4);
}
