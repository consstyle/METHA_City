'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from 'zustand';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { PAVILION_LOTS, specialistById } from '@/features/city/model/specialists';
import type { AgentStateKind } from '@/os/contract';
import type { HiringStore } from '@/os/hiringStore';
import type { OsStore } from '@/os/osStore';
import type { SimState } from '@/os/simulation/engine';
import type { Materials } from './builder/materials';
import { ORANGE } from './builder/materials';
import { pavilionLayout, type PavilionPart } from './builder/pavilion';

const STATE_COLORS: Record<AgentStateKind, number> = { offline: 0x3a4246, idle: 0x7d8a93, working: ORANGE, waiting: 0xf5c542 };

interface Props {
  readonly osStore: OsStore;
  readonly hiringStore: HiringStore;
  readonly materials: Materials;
  readonly reducedMotion: boolean;
}

/**
 * Pabellones de los especialistas (D8, D14). Aprobado: pabellón con baliza de estado y camino
 * hasta su unidad. Pendiente de Freigabe: solar reservado con un volumen naranja translúcido.
 */
export function Pavilions({ osStore, hiringStore, materials, reducedMotion }: Props) {
  const hires = useStore(hiringStore, (s) => s.hiring.hires);
  const gl = useThree((s) => s.gl);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(0.17, 14, 10), []);
  const own = useMemo(() => ({
    ghost: new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.5, transparent: true, opacity: 0.22, depthWrite: false }),
    link: new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.5 }),
    beacons: Object.fromEntries(
      (Object.keys(STATE_COLORS) as AgentStateKind[]).map((k) => [k, new THREE.MeshStandardMaterial({ color: STATE_COLORS[k], emissive: STATE_COLORS[k], emissiveIntensity: k === 'working' ? 2.2 : 0.8 })]),
    ) as Record<AgentStateKind, THREE.MeshStandardMaterial>,
  }), []);
  const beacons = useRef(new Map<string, THREE.Mesh>());
  const working = useRef(new Set<string>());
  const lastSim = useRef<SimState | null>(null);

  useEffect(() => () => {
    box.dispose();
    sphere.dispose();
    own.ghost.dispose();
    own.link.dispose();
    Object.values(own.beacons).forEach((m) => m.dispose());
  }, [box, sphere, own]);

  const items = useMemo(() => hires.flatMap((h) => {
    const lot = PAVILION_LOTS.find((l) => l.id === h.lotId);
    const role = specialistById(h.roleId);
    const unit = role && CAMPUS_UNITS.find((u) => u.id === role.unitId);
    return lot && unit ? [{ id: h.roleId, pending: h.status === 'pending', layout: pavilionLayout(lot, unit) }] : [];
  }), [hires]);

  // Las sombras son estáticas (CampusCanvas): se recalculan cuando aparece o desaparece un pabellón.
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [gl, items]);

  useFrame((frame) => {
    const sim = osStore.getState().sim;
    if (sim !== lastSim.current) {
      lastSim.current = sim;
      working.current.clear();
      beacons.current.forEach((mesh, id) => {
        const state = sim.agents.find((a) => a.id === id)?.state ?? 'offline';
        mesh.material = own.beacons[state];
        if (state === 'working') working.current.add(id);
      });
    }
    const pulse = reducedMotion ? 1.15 : 1 + 0.25 * Math.sin(frame.clock.elapsedTime * 4);
    beacons.current.forEach((mesh, id) => mesh.scale.setScalar(working.current.has(id) ? pulse : 1));
  });

  const material = (part: PavilionPart, pending: boolean): THREE.Material => {
    if (pending) return part.key === 'slab' ? materials.paving : own.ghost;
    return { slab: materials.paving, body: materials.white, roof: materials.darkSteel, edge: materials.orange, link: own.link }[part.key];
  };

  return (
    <group name="pavilions">
      {items.map(({ id, pending, layout }) => (
        <group key={id} name={`pavilion-${id}`} userData={{ role: id, pending }}>
          {layout.parts
            .filter((p) => !pending || p.key === 'slab' || p.key === 'body')
            .map((p) => (
              <mesh key={p.key} geometry={box} material={material(p, pending)} position={p.position} scale={p.size} rotation-y={p.rotationY} castShadow={!pending && p.key !== 'link'} receiveShadow />
            ))}
          {!pending && (
            <mesh
              ref={(el) => {
                if (el) beacons.current.set(id, el);
                else beacons.current.delete(id);
                lastSim.current = null;
              }}
              geometry={sphere}
              material={own.beacons.idle}
              position={layout.beacon}
            />
          )}
        </group>
      ))}
    </group>
  );
}
