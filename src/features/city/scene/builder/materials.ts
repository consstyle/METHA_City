import * as THREE from 'three';

/** Naranja del logotipo de METHABAU, usado en la escena (decisión D3). */
export const ORANGE = 0xf26a21;

const mat = (color: number, roughness = 0.55, metalness = 0.1, emissive = 0) =>
  new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive: emissive || 0, emissiveIntensity: emissive ? 1.2 : 0,
  });

/** Paleta de materiales de preview.html. */
export function createMaterials() {
  return {
    base: mat(0x3c4143, 0.9), edge: mat(0x242b2f, 0.7, 0.35), paving: mat(0x5a6060, 0.9), road: mat(0x20272c, 0.9),
    curb: mat(0x717878, 0.85), paint: mat(0xb5b7af, 0.9), orange: mat(ORANGE, 0.3, 0.35, ORANGE),
    steel: mat(0x7b888f, 0.29, 0.8), darkSteel: mat(0x343f44, 0.38, 0.65), glass: mat(0x344b55, 0.16, 0.62),
    glassDark: mat(0x182a34, 0.19, 0.64), window: mat(0xceb58d, 0.27, 0.35, 0xaf783a), warm: mat(0xf7b45d, 0.36, 0.2, 0xf49135),
    roof: mat(0x637075, 0.6, 0.35), white: mat(0xb3bab8, 0.48, 0.25), concrete: mat(0x828785, 0.92),
    green: mat(0x3b5146, 0.95), green2: mat(0x496150, 0.98), bark: mat(0x655a4d), soil: mat(0x303c34, 0.95),
    panel: mat(0x24323c, 0.16, 0.7), black: mat(0x11191f, 0.7), coord: mat(0xe3dac4, 0.35, 0.25, 0xa39b81),
    floor: mat(0x030608, 0.96, 0),
  };
}

export type Materials = ReturnType<typeof createMaterials>;

/** Intensidad de las ventanas y del naranja según «Abendlicht» (atardecer) o «Tageslicht». */
export function applyDaylight(m: Materials, day: boolean): void {
  m.window.emissiveIntensity = day ? 0.4 : 1.2;
  m.orange.emissiveIntensity = day ? 0.7 : 1.2;
}
