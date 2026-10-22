import { AgentDirectory } from '@/features/agents/AgentDirectory';
import { getMessages } from '@/i18n';
import { PageProjects } from '../PageProjects';
import type { SearchParams } from '../pageSnapshot';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata ={ title: `${getMessages().nav.agents} · METHACity` };

/** Módulo «Agenten» (Agents de NEXORA): directorio, catálogo de especialistas y Freigaben. */
export default function AgentsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <>
      <PageProjects searchParams={searchParams} />
      <AgentDirectory m={getMessages()} />
    </>
  );
}
