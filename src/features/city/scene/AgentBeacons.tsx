'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { labelAnchorHeight } from '@/features/city/model/hierarchy';
import type { AgentStateKind } from '@/os/contract';
import type { OsStore } from '@/os/osStore';
import type { SimState } from '@/os/simulation/engine';
import { activeDelegations } from '@/os/simulation/engine';
import type { BuiltCampus } from './builder/campus';
import { isRouteActive } from './builder/links';
import { ORANGE } from './builder/materials';

const COLORS: Record<AgentStateKind, number> = { offline: 0x3a4246, idle: 0x7d8a93, working: ORANGE, waiting: 0xf5c542 };
const GLOW: Record<AgentStateKind, number> = { offline: 0, idle: 0.25, working: 2.2, waiting: 1.6 };
const ROUTE_GLOW = { active: 3.2, idle: 1.25 };

/**
 * Baliza sobre cada edificio con el estado de su agente (libre, trabajando, esperando aprobación)
 * y rutas que se encienden cuando una unidad delega trabajo en otra.
 */
export function AgentBeacons({ osStore, campus, reducedMotion }: Readonly<{ osStore: OsStore | null; campus: BuiltCampus; reducedMotion: boolean }>) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.2, 14, 10), []);
  const materials = useMemo(
    () => Object.fromEntries(
      (Object.keys(COLORS) as AgentStateKind[]).map((k) => [k, new THREE.MeshStandardMaterial({ color: COLORS[k], emissive: COLORS[k], emissiveIntensity: GLOW[k], roughness: 0.4 })]),
    ) as Record<AgentStateKind, THREE.MeshStandardMaterial>,
    [],
  );
  const beacons = useRef(new Map<string, THREE.Mesh>());
  const states = useRef(new Map<string, AgentStateKind>());
  const lastSim = useRef<SimState | null>(null);

  useEffect(() => () => {
    geometry.dispose();
    Object.values(materials).forEach((mat) => mat.dispose());
  }, [geometry, materials]);

  useFrame((frame) => {
    const sim = osStore?.getState().sim ?? null;
    if (sim !== lastSim.current) {
      lastSim.current = sim;
      const delegations = sim ? activeDelegations(sim, 2) : [];
      for (const u of CAMPUS_UNITS) {
        const state = sim?.agents.find((a) => a.id === (u.agent ?? u.id))?.state ?? 'offline';
        states.current.set(u.id, state);
        const mesh = beacons.current.get(u.id);
        if (mesh) mesh.material = materials[state];
      }
      for (const route of campus.routes.animations) {
        const active = isRouteActive(route.relation, delegations);
        (route.tube.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? ROUTE_GLOW.active : ROUTE_GLOW.idle;
        route.dots.forEach((d) => d.scale.setScalar(active ? 1.7 : 1));
      }
    }
    const pulse = reducedMotion ? 1.15 : 1 + 0.25 * Math.sin(frame.clock.elapsedTime * 4);
    beacons.current.forEach((mesh, id) => mesh.scale.setScalar(states.current.get(id) === 'working' ? pulse : 1));
  });

  return (
    <group>
      {CAMPUS_UNITS.map((u) => (
        <mesh
          key={u.id}
          ref={(el) => {
            if (el) beacons.current.set(u.id, el);
            else beacons.current.delete(u.id);
          }}
          geometry={geometry}
          material={materials.offline}
          position={[u.position.x, labelAnchorHeight(u) - 0.3, u.position.z]}
        />
      ))}
    </group>
  );
}
