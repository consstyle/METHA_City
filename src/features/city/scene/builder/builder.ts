import * as THREE from 'three';
import { islandWobble } from '@/features/city/model/island';
import { createMaterials, ORANGE, type Materials } from './materials';

export type Point3 = readonly [number, number, number];

interface BoxItem {
  readonly x: number; readonly y: number; readonly z: number;
  readonly w: number; readonly h: number; readonly d: number; readonly ry: number;
}

/** Contorno orgánico de la isla y de las vías de preview.html. */
export function ellipsePoints(rx: number, rz: number, y: number, scale = 1): Point3[] {
  return Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    const f = islandWobble(a);
    return [Math.cos(a) * rx * f * scale, y, Math.sin(a) * rz * f * scale] as const;
  });
}

/** Generador pseudoaleatorio de preview.html (semilla 16): mismas ventanas y árboles que el HTML. */
export function createRandom(seed = 16): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const toVectors = (points: readonly Point3[]) => points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
export const curve = (points: readonly Point3[]) => new THREE.CatmullRomCurve3(toVectors(points));

/**
 * Ayudantes de construcción portados de preview.html. Los elementos repetidos se acumulan y se
 * convierten en InstancedMesh al llamar a `commit()`; los que llevan dueño (`owner`) son
 * seleccionables y van al grupo `pickables`.
 */
export function createSceneBuilder() {
  const root = new THREE.Group();
  const pickables = new THREE.Group();
  root.add(pickables);
  const M: Materials = createMaterials();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map<THREE.Material, BoxItem[]>();
  const rnd = createRandom();

  function shadowed<T extends THREE.Mesh>(q: T): T {
    q.castShadow = true;
    q.receiveShadow = true;
    return q;
  }

  function box(x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, ry = 0, owner: string | null = null) {
    if (owner) {
      const q = shadowed(new THREE.Mesh(boxGeo, m));
      q.position.set(x, y, z);
      q.scale.set(w, h, d);
      q.rotation.y = ry;
      q.userData.id = owner;
      pickables.add(q);
      return q;
    }
    batches.set(m, [...(batches.get(m) ?? []), { x, y, z, w, h, d, ry }]);
    return null;
  }

  function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
    const q = shadowed(new THREE.Mesh(g, m));
    q.position.set(x, y, z);
    root.add(q);
    return q;
  }

  /** Formas repetidas (cilindros, copas de árbol, tirantes) agrupadas por geometría y material. */
  const shapes = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }>();
  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();

  function shape(
    key: string, make: () => THREE.BufferGeometry, m: THREE.Material,
    position: Point3, scale: Point3 = [1, 1, 1], rotation: Point3 = [0, 0, 0],
  ) {
    const id = `${key}|${m.uuid}`;
    const entry = shapes.get(id) ?? { geometry: make(), material: m, matrices: [] };
    tmpQuat.setFromEuler(tmpEuler.set(rotation[0], rotation[1], rotation[2]));
    entry.matrices.push(new THREE.Matrix4().compose(
      new THREE.Vector3(position[0], position[1], position[2]), tmpQuat, new THREE.Vector3(scale[0], scale[1], scale[2]),
    ));
    shapes.set(id, entry);
  }

  /** Cilindro instanciado (geometría unitaria escalada); `zScale` lo ovala como las zonas verdes. */
  function cylinder(x: number, y: number, z: number, r: number, h: number, m: THREE.Material, n = 32, rt = r, zScale = 1) {
    const ratio = rt / r;
    shape(`cyl|${n}|${ratio.toFixed(4)}`, () => new THREE.CylinderGeometry(ratio, 1, 1, n), m, [x, y, z], [r, h, r * zScale]);
  }

  /** Tubo emisivo a lo largo de una curva (rutas, bordes y cables). */
  function line(points: readonly Point3[], color = ORANGE, width = 0.035, parent: THREE.Object3D = root) {
    const c = curve(points);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.25, roughness: 0.6 });
    parent.add(new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(12, points.length * 6), width, 5, false), material));
    return c;
  }

  /** Cartel con el nombre del edificio (textura de canvas). */
  function sign(text: string, x: number, y: number, z: number, w = 2.8, ry = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 128;
    const k = canvas.getContext('2d');
    if (k) {
      k.fillStyle = '#1b252b';
      k.fillRect(0, 0, canvas.width, canvas.height);
      k.font = '600 60px Arial';
      k.textAlign = 'center';
      k.textBaseline = 'middle';
      k.fillStyle = '#eee8db';
      k.fillText(text, 384, 65);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const q = mesh(new THREE.PlaneGeometry(w, w / 6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), x, y, z);
    q.rotation.y = ry;
    q.castShadow = false;
  }

  /** Convierte los elementos repetidos en InstancedMesh (pocas llamadas de dibujo). */
  function commit() {
    const dummy = new THREE.Object3D();
    for (const [material, items] of batches) {
      const inst = new THREE.InstancedMesh(boxGeo, material, items.length);
      items.forEach((a, i) => {
        dummy.position.set(a.x, a.y, a.z);
        dummy.scale.set(a.w, a.h, a.d);
        dummy.rotation.set(0, a.ry, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.instanceMatrix.needsUpdate = true;
      root.add(inst);
    }
    batches.clear();
    for (const { geometry, material, matrices } of shapes.values()) {
      const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((mx, i) => inst.setMatrixAt(i, mx));
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.instanceMatrix.needsUpdate = true;
      root.add(inst);
    }
    shapes.clear();
  }

  return { root, pickables, M, boxGeo, rnd, box, mesh, shape, cylinder, line, sign, commit };
}

export type SceneBuilder = ReturnType<typeof createSceneBuilder>;

/** Libera geometrías, materiales y texturas de un grupo construido. */
export function disposeObject(object: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => materials.add(m));
    }
  });
  materials.forEach((m) => {
    if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
    m.dispose();
  });
}
