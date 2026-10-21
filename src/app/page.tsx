import { AppHeader } from '@/components/AppHeader';
import { loadSnapshot } from '@/data/load';
import { MockDataSource, parseScenario } from '@/data/mock/MockDataSource';
import { CityExperience } from '@/features/city/CityExperience';
import { getMessages } from '@/i18n';

export const dynamic = 'force-dynamic';

/** Tiempo máximo para obtener los datos antes de mostrar el aviso de error. */
const SNAPSHOT_TIMEOUT_MS = 5_000;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const m = getMessages();
  // `?szenario=` solo tiene sentido mientras la fuente es el simulador (en B1 se limitará a él).
  const scenario = parseScenario((await searchParams).szenario);
  const result = await loadSnapshot(new MockDataSource({ scenario }), { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) });

  return (
    <>
      <AppHeader m={m} current="city" />
      <CityExperience m={m} result={result} scenario={scenario} />
    </>
  );
}
