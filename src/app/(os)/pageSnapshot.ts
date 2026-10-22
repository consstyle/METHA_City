import 'server-only';
import { loadSnapshot, type SnapshotResult } from '@/data/load';
import { MockDataSource, parseScenario } from '@/data/mock/MockDataSource';

type Scenario = ReturnType<typeof parseScenario>;

/** Tiempo máximo para obtener los datos antes de mostrar el aviso de error. */
const SNAPSHOT_TIMEOUT_MS = 5_000;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Datos de MethaDesk para una página de módulo. `?szenario=` solo tiene sentido mientras
 * la fuente es el simulador (en B1 se limitará a él).
 */
export async function loadPageSnapshot(searchParams: SearchParams): Promise<{ scenario: Scenario; result: SnapshotResult }> {
  const scenario = parseScenario((await searchParams).szenario);
  const result = await loadSnapshot(new MockDataSource({ scenario }), { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) });
  return { scenario, result };
}
