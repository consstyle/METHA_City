import { MissionsModule } from '@/features/missions/MissionsModule';
import { getMessages } from '@/i18n';
import { loadPageSnapshot, type SearchParams } from '../pageSnapshot';

export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.missions} · METHACity` };

/** Módulo «Missionen» (Missions de NEXORA): objetivo → plan → Freigabe → ejecución → informe. */
export default async function MissionsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { result } = await loadPageSnapshot(searchParams);
  return <MissionsModule m={getMessages()} result={result} />;
}
