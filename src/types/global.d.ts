export {};

declare global {
  interface Window {
    /** Diagnóstico de solo lectura de la escena 3D (pruebas e2e). */
    __methacity?: {
      renderInfo(): { calls: number; triangles: number };
      pavilions(): { role: string; pending: boolean }[];
      getState(): unknown;
      unitScreenPosition(id: string): { x: number; y: number } | null;
    };
  }
}
