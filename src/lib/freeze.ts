/** Congela un objeto y todo lo que contiene, para que las definiciones estáticas no se muten. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
