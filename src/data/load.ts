import 'server-only';
import { CitySnapshotSchema, type CityDataSource, type CitySnapshot, type GetSnapshotOptions } from './contract';

export type SnapshotResult = { readonly ok: true; readonly snapshot: CitySnapshot } | { readonly ok: false };

/**
 * Carga y valida el snapshot, venga del simulador o de la API. El error no llega a la interfaz:
 * el detalle va al registro del servidor y la pantalla muestra un mensaje genérico.
 */
export async function loadSnapshot(source: CityDataSource, options?: GetSnapshotOptions): Promise<SnapshotResult> {
  try {
    return { ok: true, snapshot: CitySnapshotSchema.parse(await source.getSnapshot(options)) };
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      console.warn('[city] carga del snapshot cancelada o agotada:', error.name);
    } else {
      console.error('[city] no se pudo cargar el snapshot:', error);
    }
    return { ok: false };
  }
}
