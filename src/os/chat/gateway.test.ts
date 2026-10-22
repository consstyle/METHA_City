import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { createSimulatedGateway } from './gateway';
import type { Scheduler } from './stream';

/** Planificador inmediato: ejecuta cada paso al momento. */
const immediate: Scheduler = { set: (fn) => { queueMicrotask(fn); return 0; }, clear: () => undefined };

test('la pasarela simulada responde en streaming con el guion del agente', async () => {
  const m = getMessages();
  const gateway = createSimulatedGateway(m, { scheduler: immediate, delayMs: 0 });
  const chunks: string[] = [];
  const result = await gateway.reply(
    { agentId: 'werkhof', text: 'Hallo', attachments: [], data: { agent: undefined, kpis: { kind: 'unavailable' }, specialists: [] } },
    { onChunk: (s) => chunks.push(s), signal: new AbortController().signal },
  );
  assert.deepEqual(result, { text: 'Grüezi! Hier ist Werkhof. Wie kann ich helfen?', stopped: false });
  assert.equal(chunks.at(-1), result.text);
  assert.ok(chunks.length > 3, 'llega por trozos');
});
