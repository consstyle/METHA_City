import * as THREE from 'three';
import type { UnitDef } from '@/features/city/model/types';
import type { SceneBuilder } from '../builder';

/** Obra activa (Bau): forjados de hormigón, pilares, grúa torre con gancho y caseta. */
export function buildSite(b: SceneBuilder, u: UnitDef): void {
  const { M } = b;
  const { x, z } = u.position;
  const { w, d } = u.size;
  b.box(x, 0.28, z, w + 0.2, 0.34, d + 0.2, M.concrete);
  for (let lv = 0; lv < 3; lv++) {
    const y = 0.5 + lv * 1.05;
    b.box(x, y, z, w, 0.17, d, M.concrete, 0, u.id);
    for (const xx of [-w / 2 + 0.1, 0, w / 2 - 0.1]) {
      for (const zz of [-d / 2 + 0.1, d / 2 - 0.1]) b.box(x + xx, y + 0.5, z + zz, 0.14, 1.05, 0.14, M.white);
    }
  }
  b.box(x, 2.8, z - d * 0.45, w, 0.12, 0.08, M.orange);
  b.box(x - w / 2, 1.8, z, 0.12, 1.9, d, M.darkSteel);
  for (let i = 0; i < 5; i++) b.box(x - w / 2 - 0.02, 1.75, z - d / 2 + (i * d) / 4, 0.03, 1.8, 0.035, M.orange);
  b.box(x + 2.9, 0.65, z + 1, 1.1, 1.2, 2.5, M.white);
  b.box(x + 2.9, 1.28, z + 1, 1.15, 0.08, 2.55, M.orange);
  b.box(x + 2.9, 0.8, z + 2.26, 0.65, 0.4, 0.04, M.glass);

  // Grúa torre: mástil de celosía, pluma, contrapeso, cabina y gancho
  const cx = x + 2.5;
  const cz = z - 1.6;
  for (const dx of [-0.17, 0.17]) for (const dz of [-0.17, 0.17]) b.box(cx + dx, 2.7, cz + dz, 0.045, 5.4, 0.045, M.orange);
  for (let y = 0.3; y < 5.4; y += 0.45) {
    b.box(cx, y, cz, 0.38, 0.045, 0.38, M.orange);
    b.shape('box', () => new THREE.BoxGeometry(1, 1, 1), M.orange, [cx, y + 0.22, cz + 0.17], [0.035, 0.59, 0.035], [0, 0, 0.62]);
  }
  b.box(cx + 1.1, 5.3, cz, 5.6, 0.17, 0.19, M.orange);
  b.box(cx - 1.2, 5.5, cz, 0.7, 0.5, 0.54, M.darkSteel);
  b.box(cx + 0.2, 5.02, cz + 0.35, 0.7, 0.62, 0.65, M.glass);
  b.line([[cx, 6.1, cz], [cx + 3.8, 5.4, cz]], 0x9ba4a6, 0.014);
  b.line([[cx, 6.1, cz], [cx - 1.5, 5.4, cz]], 0x9ba4a6, 0.014);
  b.line([[cx + 2.5, 5.3, cz], [cx + 2.5, 3.4, cz]], 0x7e8586, 0.012);
  b.box(cx + 2.5, 3.33, cz, 0.14, 0.2, 0.14, M.darkSteel);
}
