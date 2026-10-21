/** Matemática de la cámara ortográfica de preview.html, sin dependencias de three. */

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly yaw: number;
  readonly pitch: number;
  readonly zoom: number;
  readonly target: Vec3;
}

export const CAMERA_DEFAULTS: CameraPose = Object.freeze({ yaw: 0.18, pitch: 0.66, zoom: 1, target: [0, 0.3, 0] as const });
export const LIMITS = Object.freeze({ pitchMin: 0.3, pitchMax: 1.45, zoomMin: 0.72, zoomMax: 2.8 });
export const CAMERA_DISTANCE = 65;
export const TOP_VIEW_PITCH = 1.42;
export const FOCUS_ZOOM = 1.85;
export const ZOOM_STEP = 1.15;
export const YAW_STEP = 0.12;
export const PITCH_STEP = 0.08;
/** Velocidad de la órbita automática (radianes por segundo). */
export const AUTO_ROTATE_SPEED = 0.09;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const clampPitch = (p: number) => clamp(p, LIMITS.pitchMin, LIMITS.pitchMax);
export const clampZoom = (z: number) => clamp(z, LIMITS.zoomMin, LIMITS.zoomMax);

/** Encuadre: altura mínima de 34 unidades (más en pantallas estrechas), 59 % por encima del centro. */
export function frustum(aspect: number, zoom: number) {
  const h = Math.max(34, 54 / aspect) / zoom;
  return { left: (-h * aspect) / 2, right: (h * aspect) / 2, top: h * 0.59, bottom: -h * 0.41 };
}

export function orbitPosition(target: Vec3, yaw: number, pitch: number, distance = CAMERA_DISTANCE): Vec3 {
  return [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
    target[1] + Math.sin(pitch) * distance,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
  ];
}

export function applyDrag(start: { yaw: number; pitch: number }, dx: number, dy: number) {
  return { yaw: start.yaw - dx * 0.006, pitch: clampPitch(start.pitch + dy * 0.004) };
}

export const applyWheel = (zoom: number, deltaY: number) => clampZoom(zoom * Math.exp(-deltaY * 0.001));

export function applyPinch(startZoom: number, startDistance: number, distance: number): number {
  return startDistance > 0 ? clampZoom((startZoom * distance) / startDistance) : startZoom;
}

/** Fracción de acercamiento al valor deseado en este fotograma (1 = sin animación). */
export const blendFactor = (dt: number, reducedMotion: boolean) => (reducedMotion ? 1 : 1 - Math.exp(-dt * 8));

export function focusTargetFor(unit: { position: { x: number; z: number }; size: { h: number } }): Vec3 {
  return [unit.position.x, unit.size.h * 0.35, unit.position.z];
}
