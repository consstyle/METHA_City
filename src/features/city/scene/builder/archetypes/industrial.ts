import * as THREE from 'three';
import type { UnitDef } from '@/features/city/model/types';
import type { SceneBuilder } from '../builder';
import { roofEquipment } from './common';

/** Naves industriales: `factory` (Schlosserei), `sawtooth` (Blech, cubierta dentada) y `logistics` (Werkhof). */
export function buildIndustrial(b: SceneBuilder, u: UnitDef): void {
  const { M } = b;
  const { x, z } = u.position;
  const { w, d, h } = u.size;
  b.box(x, h / 2 + 0.2, z, w, h, d, M.white, 0, u.id);
  b.box(x, 0.46, z, w + 0.08, 0.5, d + 0.08, M.darkSteel);
  for (let xx = -w / 2; xx < w / 2; xx += 0.23) {
    b.box(x + xx, h / 2 + 0.2, z + d / 2 + 0.04, 0.028, h, 0.04, M.steel);
    b.box(x + xx, h / 2 + 0.2, z - d / 2 - 0.04, 0.028, h, 0.04, M.steel);
  }
  for (let zz = -d / 2; zz < d / 2; zz += 0.24) {
    b.box(x + w / 2 + 0.03, h / 2 + 0.2, z + zz, 0.04, h, 0.027, M.steel);
    b.box(x - w / 2 - 0.03, h / 2 + 0.2, z + zz, 0.04, h, 0.027, M.steel);
  }
  b.box(x, h - 0.2, z + d / 2 + 0.07, w + 0.1, 0.23, 0.08, M.orange);
  b.box(x, h + 0.26, z, w + 0.3, 0.15, d + 0.3, M.roof);
  const doors = u.archetype === 'logistics' ? 3 : 2;
  for (let i = 0; i < doors; i++) {
    const xx = x - w * 0.28 + i * (w * 0.28);
    b.box(xx, 1.03, z + d / 2 + 0.085, 0.94, 1.55, 0.08, M.darkSteel);
    for (let k = 0; k < 7; k++) b.box(xx, 0.35 + k * 0.19, z + d / 2 + 0.137, 0.84, 0.025, 0.02, M.steel);
    b.box(xx, 0.5, z + d / 2 + 0.14, 0.65, 0.045, 0.025, M.orange);
  }
  if (u.archetype === 'sawtooth') {
    for (let i = 0; i < 4; i++) {
      const xx = x - w / 2 + 0.1 + (i * w) / 4;
      const tooth = new THREE.Shape();
      tooth.moveTo(0, 0);
      tooth.lineTo(w / 4 - 0.07, 0);
      tooth.lineTo(w / 4 - 0.07, 0.6);
      tooth.closePath();
      b.mesh(new THREE.ExtrudeGeometry(tooth, { depth: d - 0.1, bevelEnabled: false }), M.roof, xx, h + 0.35, z - d / 2);
      const glass = b.mesh(new THREE.PlaneGeometry(d - 0.12, 0.45), M.glass, xx + w / 4 - 0.06, h + 0.65, z);
      glass.rotation.y = Math.PI / 2;
    }
  } else {
    roofEquipment(b, x - 1, z, h + 0.4, w * 0.55, d * 0.6);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) b.box(x + 0.5 + i * 0.6, h + 0.4, z - 0.7 + k * 0.8, 0.5, 0.045, 0.65, M.panel);
  }
  b.sign(u.name.toUpperCase(), x, h - 0.55, z + d / 2 + 0.15, Math.min(w - 1, 3.7));
  if (u.archetype === 'logistics') {
    for (let i = 0; i < 3; i++) {
      b.box(x + w / 2 + 1, 0.55, z - d / 2 + 0.5 + i * 0.95, 1.25, 1, 0.8, i === 1 ? M.orange : M.darkSteel);
      for (let j = 0; j < 7; j++) b.box(x + w / 2 + 1.64, 0.55, z - d / 2 + 0.18 + i * 0.95 + j * 0.1, 0.025, 0.93, 0.025, M.steel);
    }
  }
}
