import * as THREE from 'three';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { carrierScale, type Carrier } from '@/features/city/flow/carrier';
import type { FlowTagRegistry } from '@/features/city/flow/flowStore';
import { KIND_COLORS, MAX_ACTIVE, type TsEvent } from '@/features/city/flow/tsFlow';
import type { FlowMeshes } from './flowMeshes';

/**
 * Escritura de un fotograma del flujo de TS (camiones, anillos de llegada, etiquetas). Funciones de
 * módulo con objetos de trabajo reutilizados: a 60 fps no se crea basura.
 */

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const TAG_HEIGHT = 2.2;
/** Margen superior (título de la escena) e inferior (barra) donde no se muestran etiquetas. */
const TAG_TOP = 90;
const TAG_BOTTOM = 60;
const ORANGE_RING = new THREE.Color(0xf26a21);
export const KIND_COLOR = Object.fromEntries(
  Object.entries(KIND_COLORS).map(([k, c]) => [k, new THREE.Color(c)]),
) as Record<TsEvent['kind'], THREE.Color>;

const scratch = {
  truck: new THREE.Matrix4(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0), flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), c: new THREE.Color(),
};

/** Camiones por hueco (índice = hueco), para escribir las instancias sin buscar en cada pieza. */
export function bySlot(carriers: readonly Carrier[]): (Carrier | undefined)[] {
  const slots = new Array<Carrier | undefined>(MAX_ACTIVE);
  for (const c of carriers) slots[c.slot] = c;
  return slots;
}

export function writeTrucks(meshes: FlowMeshes, slots: readonly (Carrier | undefined)[]): void {
  const { truck, m, q, v, s, up } = scratch;
  for (let slot = 0; slot < MAX_ACTIVE; slot++) {
    const c = slots[slot];
    if (c) {
      const k = Math.max(0.001, carrierScale(c));
      truck.compose(v.set(c.x, 0.05, c.z), q.setFromAxisAngle(up, c.heading), s.set(k, k, k));
    }
    for (const { mesh, locals } of meshes.parts) {
      for (let p = 0; p < locals.length; p++) mesh.setMatrixAt(slot * locals.length + p, c ? m.multiplyMatrices(truck, locals[p]!) : HIDDEN);
    }
  }
  for (const { mesh } of meshes.parts) mesh.instanceMatrix.needsUpdate = true;
}

/** Anillos naranjas que crecen y se apagan donde acaba de llegar un TS. Devuelve si queda alguno vivo. */
export function writeRings(meshes: FlowMeshes, arrivals: number[], dt: number): boolean {
  const { m, v, s, flat, c } = scratch;
  let alive = false;
  CAMPUS_UNITS.forEach((u, i) => {
    const level = Math.max(0, (arrivals[i] ?? 0) - dt * 0.9);
    arrivals[i] = level;
    alive ||= level > 0;
    const r = (meshes.ringRadius[i] ?? 1) * (1 + (1 - level) * 0.45);
    meshes.rings.setMatrixAt(i, level > 0 ? m.compose(v.set(u.position.x, 0.3, u.position.z), flat, s.set(r, r, r)) : HIDDEN);
    meshes.rings.setColorAt(i, c.copy(ORANGE_RING).multiplyScalar(level * 0.85));
  });
  meshes.rings.instanceMatrix.needsUpdate = true;
  if (meshes.rings.instanceColor) meshes.rings.instanceColor.needsUpdate = true;
  return alive;
}

interface TagView {
  readonly camera: THREE.Camera;
  readonly width: number;
  readonly height: number;
  readonly label: (nr: number) => string;
}

/** Coloca cada etiqueta «TS 1203» sobre su camión (o la oculta si no se ve). */
export function writeTags(tags: FlowTagRegistry, slots: readonly (Carrier | undefined)[], on: boolean, view: TagView): void {
  const { v } = scratch;
  tags.tags.forEach((el, slot) => {
    if (!el) return;
    const c = slots[slot];
    if (!on || !c) {
      if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    v.set(c.x, TAG_HEIGHT, c.z).project(view.camera);
    const x = (v.x * 0.5 + 0.5) * view.width;
    const y = (-v.y * 0.5 + 0.5) * view.height;
    const visible = v.z > -1 && v.z < 1 && x > 0 && x < view.width && y > TAG_TOP && y < view.height - TAG_BOTTOM;
    el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const opacity = String(Math.round(carrierScale(c) * 100) / 100);
    if (el.style.opacity !== opacity) el.style.opacity = opacity;
    const label = view.label(c.event.nr);
    if (el.textContent !== label) el.textContent = label;
    if (el.dataset.kind !== c.event.kind) {
      el.dataset.kind = c.event.kind;
      el.className = `tstag ${c.event.kind}`;
    }
  });
}
