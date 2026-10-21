import type { SceneBuilder } from '../builder';

/** Fachada acristalada con forjados, montantes y ventanas aleatorias (preview.html `facade`). */
export function facade(b: SceneBuilder, x: number, z: number, w: number, d: number, h: number, id: string, base = 0): void {
  const { M } = b;
  b.box(x, base + h / 2, z, w, h, d, M.glass, 0, id);
  for (let y = base + 0.25; y < base + h; y += 0.52) {
    b.box(x, y, z + d / 2 + 0.026, w + 0.07, 0.055, 0.065, M.steel);
    b.box(x, y, z - d / 2 - 0.026, w + 0.07, 0.055, 0.065, M.steel);
    b.box(x - w / 2 - 0.026, y, z, 0.065, 0.055, d, M.steel);
    b.box(x + w / 2 + 0.026, y, z, 0.065, 0.055, d, M.steel);
    for (let xx = -w / 2 + 0.22; xx < w / 2; xx += 0.45) {
      if (b.rnd() > 0.48) {
        const m = b.rnd() > 0.57 ? M.window : M.glassDark;
        b.box(x + xx, y + 0.22, z + d / 2 + 0.012, 0.31, 0.3, 0.025, m);
        b.box(x + xx, y + 0.22, z - d / 2 - 0.012, 0.31, 0.3, 0.025, b.rnd() > 0.4 ? M.glassDark : M.window);
      }
    }
    for (let zz = -d / 2 + 0.2; zz < d / 2; zz += 0.48) {
      if (b.rnd() > 0.45) {
        b.box(x + w / 2 + 0.014, y + 0.22, z + zz, 0.025, 0.3, 0.35, b.rnd() > 0.6 ? M.window : M.glassDark);
        b.box(x - w / 2 - 0.014, y + 0.22, z + zz, 0.025, 0.3, 0.35, M.glassDark);
      }
    }
  }
  for (let xx = -w / 2; xx <= w / 2 + 0.01; xx += w / Math.ceil(w / 0.5)) {
    b.box(x + xx, base + h / 2, z + d / 2 + 0.055, 0.045, h, 0.08, M.darkSteel);
    b.box(x + xx, base + h / 2, z - d / 2 - 0.055, 0.045, h, 0.08, M.darkSteel);
  }
  for (let zz = -d / 2; zz <= d / 2 + 0.01; zz += d / Math.ceil(d / 0.5)) {
    b.box(x + w / 2 + 0.055, base + h / 2, z + zz, 0.08, h, 0.045, M.darkSteel);
    b.box(x - w / 2 - 0.055, base + h / 2, z + zz, 0.08, h, 0.045, M.darkSteel);
  }
  b.box(x, base + h + 0.06, z, w + 0.18, 0.12, d + 0.18, M.steel);
  b.box(x, base + 0.15, z, w + 0.22, 0.3, d + 0.22, M.darkSteel);
}

/** Equipos de cubierta: climatizadores, ventiladores y paneles solares. */
export function roofEquipment(b: SceneBuilder, x: number, z: number, y: number, w: number, d: number): void {
  const { M } = b;
  b.box(x, y + 0.18, z, w * 0.31, 0.36, d * 0.32, M.roof);
  for (let j = 0; j < 2; j++) {
    b.cylinder(x - 0.36 + j * 0.65, y + 0.39, z, 0.24, 0.08, M.black, 16);
    b.cylinder(x - 0.36 + j * 0.65, y + 0.44, z, 0.18, 0.035, M.steel, 12);
  }
  for (let j = 0; j < 3; j++) b.box(x - w * 0.32, y + 0.09, z - d * 0.3 + j * 0.4, w * 0.2, 0.06, 0.3, M.panel);
}
