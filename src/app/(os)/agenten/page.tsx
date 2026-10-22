import { AgentDirectory } from '@/features/agents/AgentDirectory';
import { getMessages } from '@/i18n';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata ={ title: `${getMessages().nav.agents} · METHACity` };

/** Módulo «Agenten» (Agents de NEXORA): directorio, catálogo de especialistas y Freigaben. */
export default function AgentsPage() {
  return <AgentDirectory m={getMessages()} />;
}
