import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KeyValueStore } from '@/lib/storage';
import { createChatStore, CONVERSATION_LIMIT } from './chatStore';
import type { AgentGateway } from './gateway';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const NOW = () => new Date('2026-10-22T09:00:00Z');
const CTX = { agent: undefined, kpis: { kind: 'unavailable' as const }, specialists: [] };

/** Pasarela de prueba: repite el texto en dos trozos, o espera a que la paren. */
const echo: AgentGateway = {
  reply: async (req, { onChunk }) => {
    onChunk('Echo: ');
    onChunk(`Echo: ${req.text}`);
    return { text: `Echo: ${req.text}`, stopped: false };
  },
};
const hanging: AgentGateway = {
  reply: (_req, { onChunk, signal }) =>
    new Promise((resolve) => {
      onChunk('Halb');
      signal.addEventListener('abort', () => resolve({ text: 'Halb', stopped: true }));
    }),
};

test('una conversación guarda la pregunta y la respuesta del agente, y se persiste', async () => {
  const kv = memory();
  const store = createChatStore({ gateway: echo, now: NOW, getStore: () => kv });
  const id = store.getState().start('bauleitung');
  await store.getState().send(id, '  Hallo  ', [{ name: 'plan.pdf', size: 10 }], CTX);
  const conv = store.getState().conversations[0]!;
  assert.equal(conv.agentId, 'bauleitung');
  assert.deepEqual(conv.messages.map((x) => [x.role, x.text]), [['user', 'Hallo'], ['agent', 'Echo: Hallo']]);
  assert.deepEqual(conv.messages[0]!.attachments, [{ name: 'plan.pdf', size: 10 }]);
  assert.equal(store.getState().streaming, null);

  const reloaded = createChatStore({ gateway: echo, now: NOW, getStore: () => kv });
  assert.deepEqual(reloaded.getState().conversations, store.getState().conversations);
});

test('mientras escribe se ve el texto parcial; «Stopp» guarda lo escrito marcado como interrumpido', async () => {
  const store = createChatStore({ gateway: hanging, now: NOW, getStore: () => memory() });
  const id = store.getState().start('chief');
  const pending = store.getState().send(id, 'Bericht?', [], CTX);
  assert.deepEqual(store.getState().streaming, { conversationId: id, text: 'Halb' });
  store.getState().stop();
  await pending;
  const last = store.getState().conversations[0]!.messages.at(-1)!;
  assert.deepEqual([last.text, last.stopped], ['Halb', true]);
  assert.equal(store.getState().streaming, null);
});

test('no se envía texto vacío ni a una conversación inexistente, ni dos a la vez', async () => {
  const store = createChatStore({ gateway: hanging, now: NOW, getStore: () => memory() });
  const id = store.getState().start('chief');
  await store.getState().send(id, '   ', [], CTX);
  await store.getState().send('nope', 'Hallo', [], CTX);
  assert.equal(store.getState().conversations[0]!.messages.length, 0);
  const first = store.getState().send(id, 'Eins', [], CTX);
  await store.getState().send(id, 'Zwei', [], CTX);
  assert.equal(store.getState().conversations[0]!.messages.length, 1, 'la segunda espera a que termine la primera');
  store.getState().stop();
  await first;
});

test('borrar y límite de conversaciones guardadas', async () => {
  const store = createChatStore({ gateway: echo, now: NOW, getStore: () => memory() });
  const ids = Array.from({ length: CONVERSATION_LIMIT + 3 }, () => store.getState().start('bau'));
  assert.equal(store.getState().conversations.length, CONVERSATION_LIMIT);
  assert.equal(store.getState().conversations[0]!.id, ids.at(-1), 'la más reciente arriba');
  store.getState().remove(ids.at(-1)!);
  assert.equal(store.getState().conversations.some((c) => c.id === ids.at(-1)), false);
});

test('un error de la pasarela no deja el chat bloqueado y queda un aviso como respuesta', async () => {
  const failing: AgentGateway = { reply: async () => { throw new Error('boom'); } };
  const store = createChatStore({ gateway: failing, now: NOW, getStore: () => memory(), errorText: 'Fehler' });
  const id = store.getState().start('bau');
  await store.getState().send(id, 'Hallo', [], CTX);
  assert.equal(store.getState().streaming, null);
  const last = store.getState().conversations[0]!.messages.at(-1)!;
  assert.deepEqual([last.role, last.text, last.stopped], ['agent', 'Fehler', true]);
});

test('los adjuntos se limitan en el propio store y las instrucciones llegan a la pasarela', async () => {
  let seen: unknown = null;
  const spy: AgentGateway = { reply: async (req) => { seen = req; return { text: 'ok', stopped: false }; } };
  const store = createChatStore({ gateway: spy, now: NOW, getStore: () => memory() });
  const id = store.getState().start('bau');
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `${'x'.repeat(300)}${i}`, size: 1.6 }));
  await store.getState().send(id, 'Hallo', many, CTX, 'Kurz antworten');
  const sent = store.getState().conversations[0]!.messages[0]!.attachments;
  assert.equal(sent.length, 10);
  assert.equal(sent[0]!.name.length, 255);
  assert.equal(sent[0]!.size, 2);
  assert.equal((seen as { instructions: string }).instructions, 'Kurz antworten');
});

test('borrar la conversación que se está escribiendo la corta sin dejar restos', async () => {
  const store = createChatStore({ gateway: hanging, now: NOW, getStore: () => memory() });
  const id = store.getState().start('chief');
  const pending = store.getState().send(id, 'Hallo', [], CTX);
  store.getState().remove(id);
  await pending;
  assert.deepEqual(store.getState().conversations, []);
  assert.equal(store.getState().streaming, null);
});

test('con la cuota llena se guardan menos conversaciones en lugar de ninguna', async () => {
  const data = new Map<string, string>();
  const limited: KeyValueStore = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { if (v.length > 900) throw new Error('QuotaExceededError'); data.set(k, v); },
    removeItem: (k) => void data.delete(k),
  };
  const store = createChatStore({ gateway: echo, now: NOW, getStore: () => limited });
  for (let i = 0; i < 8; i++) store.getState().start('bau');
  assert.equal(store.getState().conversations.length, 8, 'en memoria siguen todas');
  const saved = JSON.parse(data.get('methacity.chat.v1')!).conversations.length;
  assert.ok(saved > 0 && saved < 8, `guardadas ${saved}`);
});

test('una conversación dañada en el almacenamiento no borra las demás; reload relee', async () => {
  const kv = memory();
  const store = createChatStore({ gateway: echo, now: NOW, getStore: () => kv });
  store.getState().start('bau');
  const saved = JSON.parse(kv.data.get('methacity.chat.v1')!);
  kv.data.set('methacity.chat.v1', JSON.stringify({ conversations: [...saved.conversations, { id: 'roto' }] }));
  store.getState().reload();
  assert.equal(store.getState().conversations.length, 1);
  assert.equal(createChatStore({ gateway: echo, now: NOW, getStore: () => kv }).getState().conversations.length, 1);
});
