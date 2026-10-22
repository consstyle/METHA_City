'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { layoutLabels, type LabelInput } from '@/features/city/overlay/labelLayout';
import { COMPACT_LABELS, type LabelRegistry } from '@/features/city/overlay/labelRegistry';
import { labelTargets } from '@/features/city/overlay/labelTargets';
import type { CityStore } from '@/features/city/state/cityStore';

const STROKE_SELECTED = '#f26a2188';
const STROKE = '#95a3ad55';
/** Aunque la cámara no se mueva, se recoloca de vez en cuando (p. ej. si cambia el tamaño de una etiqueta). */
const REFRESH_FRAMES = 30;

/** Firma de lo que determina la colocación: cámara, tamaño del lienzo, selección y obras. */
function useChangeDetector() {
  const last = useRef({ matrix: new Float32Array(16), width: -1, height: -1, selected: '' as string | null, sites: null as unknown, frames: 0 });
  return (m: THREE.Matrix4, width: number, height: number, selected: string | null, sites: unknown) => {
    const s = last.current;
    s.frames += 1;
    const same = s.width === width && s.height === height && s.selected === selected && s.sites === sites
      && m.elements.every((e, i) => e === s.matrix[i]);
    if (same && s.frames < REFRESH_FRAMES) return false;
    s.matrix.set(m.elements);
    s.width = width;
    s.height = height;
    s.selected = selected;
    s.sites = sites;
    s.frames = 0;
    return true;
  };
}

/** Proyecta los anclajes de los edificios y coloca las etiquetas sin solapes cuando algo cambia. */
export function LabelProjector({ store, registry }: Readonly<{ store: CityStore; registry: LabelRegistry }>) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  const viewProjection = useMemo(() => new THREE.Matrix4(), []);
  const changed = useChangeDetector();

  useFrame(() => {
    const { selected, options, view, sites } = store.getState();
    if (!options.tags || view !== 'city') return;
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!changed(viewProjection, size.width, size.height, selected, sites)) return;

    const inputs: LabelInput[] = labelTargets(sites).map((t) => {
      v.set(...t.anchor).project(camera);
      const el = registry.labels.get(t.id);
      return {
        id: t.id,
        anchorX: (v.x * 0.5 + 0.5) * size.width,
        anchorY: (-v.y * 0.5 + 0.5) * size.height,
        w: el?.offsetWidth || 130,
        h: el?.offsetHeight || 39,
        priority: t.priority,
        onScreen: v.z > -1 && v.z < 1,
      };
    });
    for (const p of layoutLabels(inputs, size, { selected, compactAllow: COMPACT_LABELS })) {
      const el = registry.labels.get(p.id);
      const path = registry.paths.get(p.id);
      if (!el) continue;
      el.style.display = p.visible ? 'block' : 'none';
      if (path) path.style.display = p.visible ? 'block' : 'none';
      if (!p.visible) continue;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      path?.setAttribute('d', p.leader);
      path?.setAttribute('stroke', p.id === selected ? STROKE_SELECTED : STROKE);
    }
  });

  return null;
}
