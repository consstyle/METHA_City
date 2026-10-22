import { createStore } from 'zustand/vanilla';
import { createJsonStorage, type KeyValueStore } from '@/lib/storage';
import {
  ATTACHMENT_LIMIT, ATTACHMENT_NAME_MAX, ChatPersistSchema, MESSAGE_LIMIT, MESSAGE_MAX, type ChatMessage, type Conversation,
} from './contract';
import type { AgentGateway, ReplyData } from './gateway';
import type { Attachment } from './replies';

export const CONVERSATION_LIMIT = 30;

export interface ChatState {
  readonly conversations: readonly Conversation[];
  /** Respuesta que se está escribiendo (no se persiste hasta terminar). */
  readonly streaming: { readonly conversationId: string; readonly text: string } | null;
  start(agentId: string): string;
  send(conversationId: string, text: string, attachments: readonly Attachment[], data: ReplyData, instructions?: string | null): Promise<void>;
  stop(): void;
  remove(conversationId: string): void;
  /** Vuelve a leer lo guardado (otra pestaña lo cambió). */
  reload(): void;
}

export interface ChatStoreOptions {
  readonly gateway: AgentGateway;
  readonly now?: () => Date;
  readonly getStore?: () => KeyValueStore | null;
  /** Texto que queda como respuesta si la pasarela falla. */
  readonly errorText?: string;
}

let sequence = 0;
const newId = (prefix: string, now: Date) => `${prefix}-${now.getTime().toString(36)}-${(sequence++).toString(36)}`;

const cleanAttachments = (attachments: readonly Attachment[]): Attachment[] =>
  attachments.slice(0, ATTACHMENT_LIMIT).map((a) => ({ name: a.name.slice(0, ATTACHMENT_NAME_MAX) || '?', size: Math.max(0, Math.round(a.size)) }));

/** Conversaciones con los agentes; la respuesta llega en streaming desde la pasarela. */
export function createChatStore({ gateway, now = () => new Date(), getStore, errorText = '' }: ChatStoreOptions) {
  const storage = createJsonStorage('methacity.chat', 1, ChatPersistSchema, getStore);
  let controller: AbortController | null = null;

  /** Si no cabe (cuota), se guardan menos conversaciones antiguas en lugar de no guardar nada. */
  const persist = (conversations: readonly Conversation[]) => {
    for (let keep = conversations.length; keep >= 0; keep -= Math.max(1, Math.ceil(keep / 4))) {
      if (storage.save({ conversations: conversations.slice(0, keep) })) return;
      if (keep === 0) return;
    }
  };

  return createStore<ChatState>()((set, get) => {
    const update = (id: string, fn: (c: Conversation) => Conversation) => {
      const conversations = get().conversations.map((c) => (c.id === id ? fn(c) : c));
      set({ conversations });
      persist(conversations);
    };
    const append = (id: string, message: ChatMessage) =>
      update(id, (c) => ({ ...c, updatedAt: message.at, messages: [...c.messages, message].slice(-MESSAGE_LIMIT) }));
    const message = (role: ChatMessage['role'], text: string, attachments: Attachment[], stopped: boolean): ChatMessage =>
      ({ id: newId('m', now()), role, text: text.slice(0, MESSAGE_MAX), at: now().toISOString(), attachments, stopped });

    return {
      conversations: storage.load()?.conversations ?? [],
      streaming: null,
      start: (agentId) => {
        const at = now();
        const conversation: Conversation = { id: newId('c', at), agentId, createdAt: at.toISOString(), updatedAt: at.toISOString(), messages: [] };
        const conversations = [conversation, ...get().conversations].slice(0, CONVERSATION_LIMIT);
        set({ conversations });
        persist(conversations);
        return conversation.id;
      },
      send: async (conversationId, raw, rawAttachments, data, instructions = null) => {
        const text = raw.trim();
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!text || !conversation || get().streaming) return;
        const attachments = cleanAttachments(rawAttachments);
        append(conversationId, message('user', text, attachments, false));
        const ac = new AbortController();
        controller = ac;
        set({ streaming: { conversationId, text: '' } });
        let result: { text: string; stopped: boolean };
        try {
          result = await gateway.reply(
            { agentId: conversation.agentId, text: text.slice(0, MESSAGE_MAX), attachments, data, instructions },
            { signal: ac.signal, onChunk: (sofar) => { if (!ac.signal.aborted) set({ streaming: { conversationId, text: sofar } }); } },
          );
        } catch (error) {
          console.error('[chat] la respuesta del agente falló', error);
          result = { text: get().streaming?.text || errorText, stopped: true };
        }
        controller = null;
        set({ streaming: null });
        append(conversationId, message('agent', result.text, [], result.stopped));
      },
      stop: () => controller?.abort(),
      remove: (conversationId) => {
        if (get().streaming?.conversationId === conversationId) controller?.abort();
        const conversations = get().conversations.filter((c) => c.id !== conversationId);
        set({ conversations });
        persist(conversations);
      },
      reload: () => set({ conversations: storage.load()?.conversations ?? [] }),
    };
  });
}

export type ChatStore = ReturnType<typeof createChatStore>;
