import * as THREE from 'three';
import { SITE_PLATFORM, type Point, type ProjectSite } from '@/features/city/model/projects';
import type { SceneBuilder } from './builder';
import { buildSiteRoads } from './streetBuild';

/**
 * Obras de los proyectos (F5c, D26–D27) alrededor de la isla: plataforma, su calle desde AVOR (sobre
 * pilares fuera de la isla), la obra (forjados, pilares, grúa) y las oficinas de obra de Projektleitung
 * y Bauleitung. Todo con `b.box` (instanciado): las obras no añaden llamadas de dibujo.
 */

/** Oficina de obra (contenedor) de la Projektleitung o la Bauleitung. */
export const OFFICE = { w: 2.6, d: 1.3, h: 1.25 } as const;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, z: a.z - b.z });

/** Pieza en coordenadas locales de la obra (giradas con ry alrededor de `origin`). */
function placer(b: SceneBuilder, origin: Point, ry: number) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  return (lx: number, y: number, lz: number, w: number, h: number, d: number, m: THREE.Material) =>
    b.box(origin.x + lx * cos + lz * sin, y, origin.z - lx * sin + lz * cos, w, h, d, m, ry);
}

function buildPlatform(b: SceneBuilder, site: ProjectSite, ry: number): void {
  const { M } = b;
  const part = placer(b, site.position, ry);
  // Del suelo (-1,85) a la cota de la isla, con canto oscuro arriba como el borde de la isla.
  part(0, -0.95, 0, SITE_PLATFORM.w, 1.8, SITE_PLATFORM.d, M.base);
  part(0, -0.08, 0, SITE_PLATFORM.w + 0.2, 0.12, SITE_PLATFORM.d + 0.2, M.edge);
  part(0, 0.03, 0, SITE_PLATFORM.w - 0.5, 0.06, SITE_PLATFORM.d - 0.5, M.paving);
  part(0, 0.07, -SITE_PLATFORM.d / 2 + 0.3, SITE_PLATFORM.w - 0.6, 0.02, 0.05, M.orange);
}

/** La obra: forjados, pilares, malla de andamio y grúa torre (versión ligera de buildSite, sin cables). */
function buildWorks(b: SceneBuilder, site: ProjectSite, ry: number): void {
  const { M } = b;
  const part = placer(b, site.building, ry);
  const w = 4.4;
  const d = 3.2;
  part(0, 0.2, 0, w + 0.2, 0.3, d + 0.2, M.concrete);
  for (let lv = 0; lv < 3; lv++) {
    const y = 0.45 + lv * 1;
    part(0, y, 0, w, 0.16, d, M.concrete);
    for (const xx of [-w / 2 + 0.1, 0, w / 2 - 0.1]) for (const zz of [-d / 2 + 0.1, d / 2 - 0.1]) part(xx, y + 0.5, zz, 0.13, 1, 0.13, M.white);
  }
  part(0, 2.75, d * 0.48, w, 0.1, 0.07, M.orange);
  part(-w / 2, 1.7, 0, 0.1, 1.9, d, M.darkSteel);
  const cx = w / 2 + 0.6;
  const cz = 0.4;
  for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) part(cx + dx, 2.6, cz + dz, 0.045, 5.2, 0.045, M.orange);
  for (let y = 0.3; y < 5.2; y += 0.5) part(cx, y, cz, 0.36, 0.04, 0.36, M.orange);
  part(cx - 1.4, 5.15, cz, 5, 0.16, 0.18, M.orange);
  part(cx + 0.9, 5.35, cz, 0.6, 0.45, 0.5, M.darkSteel);
  part(cx - 0.1, 4.88, cz - 0.32, 0.6, 0.55, 0.55, M.glass);
}

/** Oficina de obra con franja naranja, ventanas y escalón. */
function buildOffice(b: SceneBuilder, at: Point, ry: number): void {
  const { M } = b;
  const part = placer(b, at, ry);
  part(0, OFFICE.h / 2 + 0.06, 0, OFFICE.w, OFFICE.h, OFFICE.d, M.white);
  part(0, OFFICE.h + 0.1, 0, OFFICE.w + 0.06, 0.08, OFFICE.d + 0.06, M.orange);
  for (const x of [-0.75, 0, 0.75]) part(x, 0.78, -OFFICE.d / 2 - 0.01, 0.5, 0.36, 0.03, M.glass);
  part(0.95, 0.12, -OFFICE.d / 2 - 0.25, 0.6, 0.12, 0.35, M.steel);
}

/** Altura del ancla de la etiqueta de una obra (sobre la grúa). */
export const SITE_LABEL_HEIGHT = 6.3;

export function buildProjectSites(b: SceneBuilder, sites: readonly ProjectSite[]): void {
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  buildSiteRoads(b, sites.map((s) => s.road));
  for (const site of sites) {
    // El frente de la plataforma da a la calle que llega; su eje de fondo apunta hacia fuera.
    const out = sub(site.position, site.road.at(-1) ?? site.position);
    const ry = Math.atan2(out.x, out.z);
    buildPlatform(b, site, ry);
    buildWorks(b, site, ry);
    buildOffice(b, site.offices.pl, ry);
    buildOffice(b, site.offices.bl, ry);
    // Volumen invisible para seleccionar la obra con un clic (no se dibuja).
    const pick = new THREE.Mesh(b.boxGeo, pickMaterial);
    pick.position.set(site.position.x, 1.5, site.position.z);
    pick.rotation.y = ry;
    pick.scale.set(SITE_PLATFORM.w, 3, SITE_PLATFORM.d);
    pick.userData.id = site.id;
    b.pickables.add(pick);
  }
}
