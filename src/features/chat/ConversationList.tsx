'use client';

import type { Messages } from '@/i18n';
import type { Conversation } from '@/os/chat/contract';
import { agentName } from '@/os/format';

interface Props {
  readonly m: Messages;
  readonly conversations: readonly Conversation[];
  readonly activeId: string | null;
  readonly onOpen: (c: Conversation) => void;
  readonly onRemove: (id: string) => void;
}

const preview = (c: Conversation, m: Messages) => c.messages.find((x) => x.role === 'user')?.text ?? m.chat.untitled;

/** Lista de conversaciones guardadas, la más reciente arriba. */
export function ConversationList({ m, conversations, activeId, onOpen, onRemove }: Props) {
  if (conversations.length === 0) return <p className="empty-note">{m.chat.noConversations}</p>;
  return (
    <ul className="conversation-list">
      {conversations.map((c) => (
        <li key={c.id} className={`conversation${c.id === activeId ? ' active' : ''}`} data-conversation={c.agentId}>
          <button type="button" className="conversation-open" aria-current={c.id === activeId ? 'true' : undefined} onClick={() => onOpen(c)}>
            <strong>{agentName(c.agentId, m)}</strong>
            <span>{preview(c, m)}</span>
          </button>
          <button type="button" className="chip-remove" aria-label={`${m.chat.deleteConversation}: ${agentName(c.agentId, m)}`} onClick={() => onRemove(c.id)}>×</button>
        </li>
      ))}
    </ul>
  );
}
