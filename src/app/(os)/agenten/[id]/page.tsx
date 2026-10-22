import { notFound } from 'next/navigation';
import { AgentProfile } from '@/features/agents/AgentProfile';
import { isKnownAgent } from '@/features/city/model/specialists';
import { getMessages } from '@/i18n';
import { agentName } from '@/os/format';
import { PageProjects } from '../../PageProjects';
import type { SearchParams } from '../../pageSnapshot';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: Readonly<{ params: Params }>) {
  const { id } = await params;
  return { title: `${isKnownAgent(id) ? agentName(id, getMessages()) : getMessages().nav.agents} · METHACity` };
}

/** Perfil de agente. Un especialista no contratado muestra el aviso en el cliente. */
export default async function AgentProfilePage({ params, searchParams }: Readonly<{ params: Params; searchParams: SearchParams }>) {
  const { id } = await params;
  if (!isKnownAgent(id)) notFound();
  return (
    <>
      <PageProjects searchParams={searchParams} />
      <AgentProfile m={getMessages()} agentId={id} />
    </>
  );
}
