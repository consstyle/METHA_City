import * as THREE from 'three';
import { labelAnchorHeight } from '@/features/city/model/hierarchy';
import type { RelationDef, UnitDef, UnitId } from '@/features/city/model/types';
import { createSceneBuilder, disposeObject } from './builder';
import { ORANGE } from './materials';
import { buildIndustrial } from './archetypes/industrial';
import { buildOffice, buildTerrace, buildTower } from './archetypes/offices';
import { buildSite } from './archetypes/site';
import { buildTerrain } from './terrain';
import { buildParking, buildTraffic } from './vehicles';
import { buildBridge, buildRoutes } from './links';

const ARCHETYPE_BUILDERS = {
  tower: buildTower, office: buildOffice, terrace: buildTerrace, site: buildSite,
  factory: buildIndustrial, sawtooth: buildIndustrial, logistics: buildIndustrial,
} as const;

function selectionRing(u: UnitDef): THREE.Mesh {
  const r = Math.max(u.size.w, u.size.d) * 0.63;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r, r + 0.065, 64),
    new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.position.set(u.position.x, 0.285, u.position.z);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  return ring;
}

/**
 * Construye la ciudad completa en el orden de preview.html (el orden importa: la semilla
 * aleatoria reparte ventanas y árboles igual que en el HTML). Solo funciona en el navegador.
 */
export function buildCampus(units: readonly UnitDef[], relations: readonly RelationDef[]) {
  const b = createSceneBuilder();
  const { ringPath } = buildTerrain(b);

  const rings = new Map<UnitId, THREE.Mesh>();
  for (const u of units) {
    const { x, z } = u.position;
    const { w, d } = u.size;
    b.box(x, 0.14, z, w + 1, 0.24, d + 1, b.M.paving);
    const ring = selectionRing(u);
    b.root.add(ring);
    rings.set(u.id, ring);
    ARCHETYPE_BUILDERS[u.archetype](b, u);
    b.box(x, 0.275, z + d / 2 + 0.35, w * 0.7, 0.018, 0.025, b.M.orange);
  }

  buildParking(b);
  buildBridge(b);
  b.commit();
  const routes = buildRoutes(b, units, relations);

  const orchestrator = units.find((u) => u.parent === null && u.archetype === 'tower');
  if (orchestrator) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(3.85, 3.89, 80),
      new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(orchestrator.position.x, 0.285, orchestrator.position.z);
    b.root.add(halo);
  }

  const cars = buildTraffic(b);
  const labelAnchors = new Map(units.map((u) => [u.id, new THREE.Vector3(u.position.x, labelAnchorHeight(u), u.position.z)] as const));

  return {
    root: b.root,
    pickables: b.pickables,
    materials: b.M,
    ringPath,
    rings,
    routes,
    cars,
    labelAnchors,
    dispose: () => {
      disposeObject(b.root);
      b.boxGeo.dispose();
    },
  };
}

export type BuiltCampus = ReturnType<typeof buildCampus>;
