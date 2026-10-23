'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from 'zustand';
import type { CityStore } from '@/features/city/state/cityStore';
import {
  AUTO_ROTATE_SPEED, CAMERA_DEFAULTS, applyDrag, applyPinch, applyWheel, blendFactor, frustum, orbitPosition,
} from './camera/cameraMath';
import { extentOf } from '@/features/city/state/cityStore';
import { handleCameraKey } from './camera/keyboard';

interface Props {
  readonly store: CityStore;
  readonly reducedMotion: boolean;
}

/** Cámara ortográfica de preview.html: se acerca con amortiguación a la pose deseada del estado. */
export function CameraRig({ store, reducedMotion }: Props) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const pose = useRef({ yaw: CAMERA_DEFAULTS.yaw, pitch: CAMERA_DEFAULTS.pitch, zoom: CAMERA_DEFAULTS.zoom, target: new THREE.Vector3(...CAMERA_DEFAULTS.target) });
  const wanted = useRef(new THREE.Vector3());
  // La proporción real del escenario va al estado: encuadre, zoom máximo y enfoque usan el mismo factor.
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => store.getState().setAspect(aspect), [store, aspect]);
  const extent = useStore(store, extentOf);

  useFrame((_, delta) => {
    const dt = Math.min(0.07, delta);
    const state = store.getState();
    if (state.options.auto && !reducedMotion) state.rotateBy(dt * AUTO_ROTATE_SPEED);
    const { camera: c } = store.getState();
    const k = blendFactor(dt, reducedMotion);
    const p = pose.current;
    p.yaw += (c.yaw - p.yaw) * k;
    p.pitch += (c.pitch - p.pitch) * k;
    p.zoom += (c.zoom - p.zoom) * k;
    p.target.lerp(wanted.current.set(...c.target), k);

    const f = frustum(aspect, p.zoom, extent);
    camera.left = f.left;
    camera.right = f.right;
    camera.top = f.top;
    camera.bottom = f.bottom;
    camera.position.set(...orbitPosition([p.target.x, p.target.y, p.target.z], p.yaw, p.pitch));
    camera.lookAt(p.target);
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
    let pinch: { distance: number; zoom: number } | null = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      const { yaw, pitch, zoom } = store.getState().camera;
      drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false };
      if (pointers.size === 2) {
        pinch = { distance: spread(), zoom };
        drag.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        store.getState().setZoom(applyPinch(pinch.zoom, pinch.distance, spread(), extentOf(store.getState())));
        return;
      }
      if (!drag || pointers.size !== 1) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        store.getState().stopAuto();
        store.getState().setOrbit(applyDrag(drag, dx, dy));
        el.classList.add('grabbing');
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = null;
      drag = null;
      el.classList.remove('grabbing');
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      store.getState().setZoom(applyWheel(store.getState().camera.zoom, e.deltaY, extentOf(store.getState())));
    };
    const key = (e: KeyboardEvent) => {
      if (handleCameraKey(e.key, store.getState())) e.preventDefault();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
    };
  }, [gl, store]);

  return null;
}
