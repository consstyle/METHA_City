/** Elementos DOM de las etiquetas, compartidos entre la capa HTML y el proyector de la escena. */
export interface LabelRegistry {
  readonly labels: Map<string, HTMLElement>;
  readonly paths: Map<string, SVGPathElement>;
}

export const createLabelRegistry = (): LabelRegistry => ({ labels: new Map(), paths: new Map() });

/** En pantallas estrechas solo se etiquetan AVOR y Planer (y lo que esté seleccionado). */
export const COMPACT_LABELS: readonly string[] = ['avor', 'planer'];
