/**
 * Vista inicial de la ciudad (F5c): cámara por defecto, encuadre y cuánto hay que abrirlo para ver
 * las obras. Sin dependencias de three ni de la escena: también lo usa el modelo (siteLayout.ts).
 */

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly yaw: number;
  readonly pitch: number;
  readonly zoom: number;
  readonly target: Vec3;
}

export const CAMERA_DEFAULTS: CameraPose = Object.freeze({ yaw: 0.18, pitch: 0.66, zoom: 1, target: [0, 0.3, 0] as const });
/**
 * Encuadre: altura mínima de 34 unidades (más en pantallas estrechas), 59 % por encima del centro.
 * `extent` agranda el encuadre cuando hay obras de proyecto fuera de la isla (ver sceneExtent).
 */
export function frustum(aspect: number, zoom: number, extent = 1) {
  const h = (Math.max(34, 54 / aspect) * extent) / zoom;
  return { left: (-h * aspect) / 2, right: (h * aspect) / 2, top: h * 0.59, bottom: -h * 0.41 };
}

/** Proporción de referencia del escenario cuando no se conoce (escritorio con el panel lateral). */
export const REFERENCE_ASPECT = 1.3;
/** Parte del encuadre utilizable: margen lateral, el título arriba y la barra de herramientas abajo. */
const FIT = { x: 0.93, top: 0.88, bottom: 0.8 } as const;
/** Zona del título «Eine Stadt. Alles verbunden.» (arriba a la izquierda), en fracciones del encuadre. */
const TITLE = { left: -0.35, top: 0.42 } as const;
/** Media plataforma de una obra y altura de su etiqueta sobre la grúa. */
const SITE_HALF = 6;
const SITE_TOP = 8.5;

/**
 * Cuánto hay que agrandar el encuadre inicial (zoom 1) para que el punto se vea: < 1 si ya cabe.
 * Proyección ortográfica de la cámara por defecto (CAMERA_DEFAULTS), como hace three.
 */
export function fitFactor(p: { readonly x: number; readonly y: number; readonly z: number }, aspect = REFERENCE_ASPECT): number {
  const { yaw, pitch, target } = CAMERA_DEFAULTS;
  const dx = p.x - target[0];
  const dz = p.z - target[2];
  const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const sy = -(dx * Math.sin(yaw) + dz * Math.cos(yaw)) * Math.sin(pitch) + (p.y - target[1]) * Math.cos(pitch);
  const f = frustum(aspect, 1);
  const across = Math.abs(sx) / (f.right * FIT.x);
  const up = sy / (f.top * FIT.top);
  const down = -sy / (-f.bottom * FIT.bottom);
  // Bajo el título no debe quedar nada: ahí la parte útil llega solo hasta TITLE.top.
  const title = sx / f.right < TITLE.left && sy > 0 ? sy / (f.top * TITLE.top) : 0;
  return Math.max(across, up, down, title);
}

/** Puntos que deben verse de una obra: las esquinas de su plataforma y su etiqueta. */
export function siteFitPoints(c: { readonly x: number; readonly z: number }) {
  return [
    { x: c.x - SITE_HALF, y: 0, z: c.z }, { x: c.x + SITE_HALF, y: 0, z: c.z },
    { x: c.x, y: 0, z: c.z - SITE_HALF }, { x: c.x, y: 0, z: c.z + SITE_HALF },
    { x: c.x, y: SITE_TOP, z: c.z },
  ];
}

/** Factor de encuadre para que entren las obras (1 = solo la isla, como antes de F5c). */
export function sceneExtent(points: readonly { readonly x: number; readonly z: number }[], aspect = REFERENCE_ASPECT): number {
  return Math.max(1, ...points.flatMap((c) => siteFitPoints(c).map((q) => fitFactor(q, aspect))));
}
