import { CityExperience } from '@/features/city/CityExperience';
import { getMessages } from '@/i18n';
import { loadPageSnapshot, type SearchParams } from './pageSnapshot';

export const dynamic = 'force-dynamic';

/** Módulo «Stadt»: pantalla de inicio del sistema (decisión D9). */
export default async function CityPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { scenario, result } = await loadPageSnapshot(searchParams);
  return <CityExperience m={getMessages()} result={result} scenario={scenario} />;
}
