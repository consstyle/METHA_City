import * as THREE from 'three';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { MAX_ACTIVE } from '@/features/city/flow/tsFlow';
import type { Materials } from './builder/materials';
import { ORANGE } from './builder/materials';

/**
 * Mallas instanciadas del flujo de TS: cada pieza del camión es un InstancedMesh con hueco para
 * MAX_ACTIVE camiones, así que el flujo cuesta siempre las mismas llamadas de dibujo (6).
 */

/** Escala de los camiones respecto a los aparcados (preview.html usa 1.6 en su campus, más grande). */
export const TRUCK_SCALE = 1.5;

interface PartDef {
  readonly size: readonly [number, number, number];
  readonly pos: readonly [number, number, number];
}

/** Piezas del camión de preview.html (`makeCarrier`). La caja de carga lleva el color del tipo de TS. */
const CHASSIS: PartDef = { size: [0.43, 0.14, 1.05], pos: [0, 0.2, 0] };
const CAB: PartDef = { size: [0.43, 0.3, 0.34], pos: [0, 0.37, 0.36] };
const GLASS: PartDef = { size: [0.35, 0.1, 0.02], pos: [0, 0.42, 0.54] };
const CARGO: PartDef = { size: [0.4, 0.36, 0.58], pos: [0, 0.45, -0.14] };
const WHEELS: readonly PartDef[] = [-0.24, 0.24].flatMap((x) => [-0.34, 0.34].map((z): PartDef => ({ size: [0.07, 0.14, 0.16], pos: [x, 0.09, z] })));

const local = ({ size, pos }: PartDef) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...pos).multiplyScalar(TRUCK_SCALE),
    new THREE.Quaternion(),
    new THREE.Vector3(...size).multiplyScalar(TRUCK_SCALE),
  );

export interface FlowMeshes {
  readonly group: THREE.Group;
  /** Pieza instanciada + su matriz local + cuántas lleva cada camión. */
  readonly parts: readonly { mesh: THREE.InstancedMesh; locals: readonly THREE.Matrix4[] }[];
  readonly cargo: THREE.InstancedMesh;
  readonly rings: THREE.InstancedMesh;
  readonly ringRadius: readonly number[];
  dispose(): void;
}

export function createFlowMeshes(materials: Materials): FlowMeshes {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cargoMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ringGeometry = new THREE.RingGeometry(1, 1.06, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const instanced = (material: THREE.Material, perTruck: number) => {
    const mesh = new THREE.InstancedMesh(box, material, MAX_ACTIVE * perTruck);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  };
  const cargo = instanced(cargoMaterial, 1);
  cargo.setColorAt(0, new THREE.Color(ORANGE));
  const parts = [
    { mesh: instanced(materials.darkSteel, 1), locals: [local(CHASSIS)] },
    { mesh: instanced(materials.white, 1), locals: [local(CAB)] },
    { mesh: instanced(materials.glass, 1), locals: [local(GLASS)] },
    { mesh: cargo, locals: [local(CARGO)] },
    { mesh: instanced(materials.black, WHEELS.length), locals: WHEELS.map(local) },
  ];
  const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, CAMPUS_UNITS.length);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.setColorAt(0, new THREE.Color(0x000000));
  rings.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'ts-flow';
  // Todas las instancias empiezan ocultas (si no, la matriz identidad las pinta en el origen).
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  [...parts.map((p) => p.mesh), rings].forEach((m) => {
    for (let i = 0; i < m.count; i++) m.setMatrixAt(i, hidden);
    m.castShadow = false;
    group.add(m);
  });
  return {
    group,
    parts,
    cargo,
    rings,
    ringRadius: CAMPUS_UNITS.map((u) => Math.max(u.size.w, u.size.d) * 0.75),
    dispose: () => {
      // Los InstancedMesh guardan sus propios búferes (matrices y colores) en la GPU.
      [...parts.map((p) => p.mesh), rings].forEach((m) => m.dispose());
      box.dispose();
      cargoMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}
