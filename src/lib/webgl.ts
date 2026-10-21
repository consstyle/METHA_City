/** true si el navegador puede crear un contexto WebGL (si no, solo queda el panel y la jerarquía). */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
