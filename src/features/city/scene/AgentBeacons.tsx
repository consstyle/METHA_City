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
import type { ProjectSite } from '@/features/city/model/projects';
import type { BuiltCampus } from './builder/campus';
import { isRouteActive } from './builder/links';
import { OFFICE } from './builder/projectSites';
import { ORANGE } from './builder/materials';

const COLORS: Record<AgentStateKind, number> = { offline: 0x3a4246, idle: 0x7d8a93, working: ORANGE, waiting: 0xf5c542 };
const GLOW: Record<AgentStateKind, number> = { offline: 0, idle: 0.25, working: 2.2, waiting: 1.6 };
const ROUTE_GLOW = { active: 3.2, idle: 1.25 };

/**
 * Baliza sobre cada edificio con el estado de su agente (libre, trabajando, esperando aprobación)
 * y rutas que se encienden cuando una unidad delega trabajo en otra.
 */
interface Props {
  readonly osStore: OsStore | null;
  readonly campus: BuiltCampus;
  readonly sites: readonly ProjectSite[];
  readonly reducedMotion: boolean;
}

interface Beacon {
  readonly agentId: string;
  readonly position: readonly [number, number, number];
}

/** Una baliza por agente: sobre cada edificio del campus y sobre cada oficina de obra (PL y BL). */
function beaconsFor(sites: readonly ProjectSite[]): Beacon[] {
  const office = (agentId: string, p: { x: number; z: number }): Beacon => ({ agentId, position: [p.x, OFFICE.h + 0.65, p.z] });
  return [
    ...CAMPUS_UNITS.map((u) => ({ agentId: u.agent ?? u.id, position: [u.position.x, labelAnchorHeight(u) - 0.3, u.position.z] as const })),
    ...sites.flatMap((s) => [office(s.agents.pl, s.offices.pl), office(s.agents.bl, s.offices.bl)]),
  ];
}

export function AgentBeacons({ osStore, campus, sites, reducedMotion }: Props) {
  const list = useMemo(() => beaconsFor(sites), [sites]);
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

  // Balizas nuevas (cambian las obras o se reconstruye la ciudad): se repintan en el siguiente fotograma.
  useEffect(() => {
    lastSim.current = null;
  }, [list, campus]);

  useFrame((frame) => {
    const sim = osStore?.getState().sim ?? null;
    if (sim !== lastSim.current) {
      lastSim.current = sim;
      const delegations = sim ? activeDelegations(sim, 2) : [];
      for (const { agentId } of list) {
        const state = sim?.agents.find((a) => a.id === agentId)?.state ?? 'offline';
        states.current.set(agentId, state);
        const mesh = beacons.current.get(agentId);
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
      {list.map((beacon) => (
        <mesh
          key={beacon.agentId}
          ref={(el) => {
            if (el) beacons.current.set(beacon.agentId, el);
            else beacons.current.delete(beacon.agentId);
          }}
          geometry={geometry}
          material={materials.offline}
          position={beacon.position}
        />
      ))}
    </group>
  );
}
