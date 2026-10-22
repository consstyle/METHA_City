/** Colocación de etiquetas sin solapes, portada de `labels()` de preview.html. Función pura. */

export interface LabelInput {
  readonly id: string;
  /** Anclaje proyectado en píxeles del lienzo. */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly w: number;
  readonly h: number;
  /** Mayor prioridad = se coloca antes (en el HTML: edificios más altos). */
  readonly priority: number;
  /** false si el anclaje está detrás de la cámara. */
  readonly onScreen: boolean;
}

export interface LabelPlacement {
  readonly id: string;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Trazo SVG de la línea guía desde la etiqueta hasta el edificio. */
  readonly leader: string;
}

export interface LayoutOptions {
  readonly selected: string | null;
  /** En pantallas estrechas solo se muestran estas (y la seleccionada). */
  readonly compactAllow?: readonly string[];
  readonly compactWidth?: number;
  /** Límite superior (debajo del título de la escena) e inferior (encima de la barra). */
  readonly top?: number;
  readonly bottomPad?: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function layoutLabels(
  inputs: readonly LabelInput[],
  viewport: { readonly width: number; readonly height: number },
  { selected, compactAllow = [], compactWidth = 600, top = 135, bottomPad = 80 }: LayoutOptions,
): LabelPlacement[] {
  const { width, height } = viewport;
  const compact = width < compactWidth;
  const sorted = [...inputs].sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : b.priority - a.priority));
  const placed: { x: number; y: number; w: number; h: number }[] = [];

  return sorted.map((l) => {
    const hidden: LabelPlacement = { id: l.id, visible: false, x: 0, y: 0, w: l.w, h: l.h, leader: '' };
    if (compact && l.id !== selected && !compactAllow.includes(l.id)) return hidden;
    if (!l.onScreen) return hidden;
    let x = l.anchorX;
    let y = l.anchorY - 8;
    if (!(x > -l.w && x < width + l.w && y > -l.h && y < height - 45)) return hidden;

    x = clamp(x, l.w / 2 + 6, width - l.w / 2 - 6);
    y = clamp(y, top, height - bottomPad);
    for (let j = 0; j < 10; j++) {
      const overlap = placed.find((r) => Math.abs(x - r.x) < (l.w + r.w) / 2 + 4 && Math.abs(y - r.y) < Math.max(l.h, r.h) + 6);
      if (!overlap) break;
      y -= l.h + 8;
      if (y < top - 5) {
        y = overlap.y + l.h + 10;
        x += l.w * 0.45;
      }
    }
    x = clamp(x, l.w / 2 + 6, width - l.w / 2 - 8);
    placed.push({ x, y, w: l.w, h: l.h });
    return { id: l.id, visible: true, x, y, w: l.w, h: l.h, leader: `M${x},${y + 1} L${x},${y + 10} L${l.anchorX},${l.anchorY + 9}` };
  });
}
