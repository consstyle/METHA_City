import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, streamText, type Scheduler } from './stream';

/** Planificador manual: avanza los temporizadores a mano, sin esperar tiempo real. */
function manualScheduler() {
  const queue: { fn: () => void; id: number }[] = [];
  let next = 1;
  const scheduler: Scheduler = {
    set: (fn) => {
      const id = next++;
      queue.push({ fn, id });
      return id;
    },
    clear: (id) => {
      const i = queue.findIndex((q) => q.id === id);
      if (i >= 0) queue.splice(i, 1);
    },
  };
  const flush = (n = Infinity) => {
    for (let i = 0; i < n && queue.length > 0; i++) queue.shift()!.fn();
  };
  return { scheduler, flush, pending: () => queue.length };
}

test('chunkText reparte por palabras sin perder ni un carácter', () => {
  const text = 'Ich arbeite gerade an: «Abrufe prüfen».\nDanke!';
  const chunks = chunkText(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.length >= 6);
  assert.deepEqual(chunkText(''), []);
});

test('streamText entrega el texto por trozos y termina con el texto completo', async () => {
  const { scheduler, flush } = manualScheduler();
  const seen: string[] = [];
  const done = streamText('Eins zwei drei', { onChunk: (sofar) => seen.push(sofar), scheduler, delayMs: 10 });
  flush();
  assert.deepEqual(await done, { text: 'Eins zwei drei', stopped: false });
  assert.deepEqual(seen, ['Eins ', 'Eins zwei ', 'Eins zwei drei']);
});

test('se puede parar a mitad: devuelve lo escrito hasta entonces y no deja temporizadores', async () => {
  const { scheduler, flush, pending } = manualScheduler();
  const controller = new AbortController();
  const done = streamText('Eins zwei drei vier', { onChunk: () => undefined, scheduler, delayMs: 10, signal: controller.signal });
  flush(2);
  controller.abort();
  assert.deepEqual(await done, { text: 'Eins zwei ', stopped: true });
  assert.equal(pending(), 0);
});

test('una señal ya abortada no escribe nada', async () => {
  const { scheduler } = manualScheduler();
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await streamText('Hallo', { onChunk: () => assert.fail('no debería escribir'), scheduler, signal: controller.signal }), { text: '', stopped: true });
});
