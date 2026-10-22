import type { z } from 'zod';

/** Lo mínimo de `Storage` que se usa (permite probar sin navegador). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserStore = (): KeyValueStore | null => (typeof window === 'undefined' ? null : window.localStorage);

/**
 * Persistencia local versionada y validada (D15). Nunca lanza: sin almacenamiento o con datos
 * corruptos se comporta como si no hubiera nada guardado. `save` dice si pudo guardar (cuota).
 */
export function createJsonStorage<S extends z.ZodTypeAny>(name: string, version: number, schema: S, getStore: () => KeyValueStore | null = browserStore) {
  const key = `${name}.v${version}`;
  const discard = () => {
    try {
      getStore()?.removeItem(key);
    } catch {
      // sin acceso al almacenamiento: no hay nada que limpiar
    }
  };
  return {
    key,
    load(): z.infer<S> | null {
      try {
        const raw = getStore()?.getItem(key);
        if (raw == null) return null;
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // JSON roto o almacenamiento inaccesible
      }
      discard();
      return null;
    },
    save(value: z.infer<S>): boolean {
      try {
        const store = getStore();
        store?.setItem(key, JSON.stringify(value));
        return store !== null;
      } catch (error) {
        console.warn(`[storage] no se pudo guardar ${key}`, error);
        return false;
      }
    },
  };
}
