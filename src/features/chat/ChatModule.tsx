'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useScenarioQuery } from '@/components/useScenarioQuery';
import type { SnapshotResult } from '@/data/load';
import { filterAgents } from '@/features/agents/directory';
import type { Messages } from '@/i18n';
import type { Attachment } from '@/os/chat/replies';
import { agentName } from '@/os/format';
import { useAgentSettings, useChat, useHiring, useSim } from '@/os/OsProvider';
import { ChatThread } from './ChatThread';
import { Composer } from './Composer';
import { ConversationList } from './ConversationList';
import { replyData } from './replyData';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly initialAgent: string;
}

/** Módulo «Chat»: conversaciones con el Chief, las unidades y los especialistas (F4). */
export function ChatModule({ m, result, initialAgent }: Props) {
  const sim = useSim();
  const conversations = useChat((s) => s.conversations);
  const streaming = useChat((s) => s.streaming);
  const chat = useChat((s) => s);
  const hires = useHiring((s) => s.hiring.hires);
  const instructions = useAgentSettings((s) => s.instructions);
  const router = useRouter();
  const query = useScenarioQuery();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState(initialAgent);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  // ?agent=… manda (también al volver a /chat desde el carril): se continúa su última conversación.
  const hydrated = conversations !== null;
  useEffect(() => {
    if (!hydrated) return;
    setSelected(initialAgent);
    setConversationId(conversations.find((c) => c.agentId === initialAgent)?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el agente de la URL o llega el historial
  }, [hydrated, initialAgent]);

  const list = conversations ?? [];
  const conversation = list.find((c) => c.id === conversationId) ?? null;
  // El agente de la conversación abierta manda sobre el selector: nunca se mezclan.
  const agentId = conversation?.agentId ?? selected;
  const agents = useMemo(() => (sim ? filterAgents(sim.agents, 'all') : []), [sim]);
  const label = agentName(agentId, m);
  const busy = streaming !== null;
  const pendingHire = hires?.some((h) => h.roleId === agentId && h.status === 'pending') ?? false;
  // Un especialista no contratado (o pendiente de Freigabe) no puede recibir mensajes.
  const unavailable = sim !== null && !agents.some((a) => a.id === agentId);

  const goTo = (id: string) => router.replace(`/chat?agent=${encodeURIComponent(id)}${query.replace('?', '&')}`, { scroll: false });
  const pickAgent = (id: string) => {
    setSelected(id);
    setConversationId(null);
    goTo(id);
  };
  const send = (text: string, attachments: readonly Attachment[]) => {
    if (!chat) return;
    const id = conversation?.id ?? chat.start(agentId);
    setConversationId(id);
    void chat.send(id, text, attachments, replyData(agentId, sim, result), instructions?.[agentId] ?? null);
  };

  return (
    <main className="module-page chat-page" aria-labelledby="chat-title">
      <header className="module-head">
        <div className="eyebrow">{m.chat.eyebrow}</div>
        <h1 id="chat-title">{m.chat.title}</h1>
        <p className="sim-note"><span className="sim-tag">{m.sim.badge}</span> {m.cockpit.simulation}</p>
      </header>
      <div className="chat-layout">
        <aside className="card chat-side" aria-labelledby="conversations-title">
          <label className="field-label" htmlFor="chat-agent">{m.chat.agentLabel}</label>
          <select id="chat-agent" className="text-input" value={agentId} onChange={(e) => pickAgent(e.target.value)} disabled={busy}>
            {(agents.length === 0 || unavailable) && <option value={agentId}>{label}</option>}
            {agents.map((a) => <option key={a.id} value={a.id}>{agentName(a.id, m)}</option>)}
          </select>
          <button type="button" className="ghost-btn small" disabled={busy} onClick={() => setConversationId(null)}>+ {m.chat.newConversation}</button>
          <h2 id="conversations-title" ref={listHeading} tabIndex={-1} className="card-title spaced">{m.chat.conversations}</h2>
          <ConversationList
            m={m}
            conversations={list}
            activeId={conversationId}
            onOpen={(c) => {
              if (busy) return;
              setSelected(c.agentId);
              setConversationId(c.id);
              goTo(c.agentId);
            }}
            onRemove={(id) => {
              chat?.remove(id);
              if (id === conversationId) setConversationId(null);
              setNotice(m.chat.deleted);
              listHeading.current?.focus();
            }}
          />
          <p className="sr-only" role="status">{notice}</p>
        </aside>
        <section className="card chat-main" aria-label={label}>
          <div className="chat-main-head">
            <strong>{label}</strong>
          </div>
          {unavailable && <p className="notice chat-notice" role="alert">{pendingHire ? m.profile.pendingHire : m.profile.notFound}</p>}
          <ChatThread m={m} agentLabel={label} conversation={conversation} streaming={streaming && streaming.conversationId === conversationId ? streaming.text : null} />
          <Composer m={m} agentLabel={label} busy={busy} disabled={!chat || unavailable} onSend={send} onStop={() => chat?.stop()} />
        </section>
      </div>
    </main>
  );
}
