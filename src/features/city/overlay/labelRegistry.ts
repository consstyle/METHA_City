/** Elementos DOM de las etiquetas, compartidos entre la capa HTML y el proyector de la escena. */
export interface LabelRegistry {
  readonly labels: Map<string, HTMLElement>;
  readonly paths: Map<string, SVGPathElement>;
}

export const createLabelRegistry = (): LabelRegistry => ({ labels: new Map(), paths: new Map() });

/** En pantallas estrechas solo se etiquetan las cabeceras y la coordinación (y la unidad seleccionada). */
export const COMPACT_LABELS: readonly string[] = ['avor', 'projektleitung', 'bauleitung'];
