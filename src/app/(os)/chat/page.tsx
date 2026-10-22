import { ChatModule } from '@/features/chat/ChatModule';
import { ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { isKnownAgent } from '@/features/city/model/specialists';
import { getMessages } from '@/i18n';
import { loadPageSnapshot, type SearchParams } from '../pageSnapshot';

export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.chat} · METHACity` };

/** Módulo «Chat»: `?agent=` elige con quién hablar (por defecto, el Methabau Chief). */
export default async function ChatPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const raw = Array.isArray(params.agent) ? params.agent[0] : params.agent;
  const { result } = await loadPageSnapshot(searchParams);
  return <ChatModule m={getMessages()} result={result} initialAgent={isKnownAgent(raw) ? raw : ORCHESTRATOR_AGENT} />;
}
