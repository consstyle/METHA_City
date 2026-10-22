import { Cockpit } from '@/features/cockpit/Cockpit';
import { ProjectsSync } from '@/features/projects/ProjectsSync';
import { getMessages } from '@/i18n';
import { loadPageSnapshot, type SearchParams } from '../pageSnapshot';

export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.cockpit} · METHACity` };

/** Módulo «Leitstand» (Cockpit de NEXORA): estado de agentes, trabajo, sistema y MethaDesk. */
export default async function CockpitPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { result } = await loadPageSnapshot(searchParams);
  return (
    <>
      <ProjectsSync result={result} />
      <Cockpit m={getMessages()} result={result} />
    </>
  );
}
