import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import type { SimAgent } from '../simulation/engine';
import { composeReply, detectIntents, type ReplyContext } from './replies';

const m = getMessages();
const agent = (over: Partial<SimAgent> = {}): SimAgent => ({
  id: 'bauleitung', kind: 'unit', unitId: 'bauleitung', state: 'idle', taskIndex: null, since: 0, busyFor: 0, lastActiveAt: null, ...over,
});
const ctx = (text: string, over: Partial<ReplyContext> = {}): ReplyContext => ({
  agentId: 'bauleitung', text, attachments: [], agent: agent(), kpis: { kind: 'unit', hasData: true, open: 3, total: 9, overdue: 1, rework: 2 },
  specialists: [], ...over,
});

test('reconoce intenciones en alemán, también varias a la vez', () => {
  assert.deepEqual(detectIntents('Grüezi! Woran arbeitest du gerade?'), ['greeting', 'status']);
  assert.deepEqual(detectIntents('Wie viele Montagen sind überfällig?'), ['kpis']);
  assert.deepEqual(detectIntents('Was kannst du?'), ['help']);
  assert.deepEqual(detectIntents('Bitte übernimm den Auftrag für das Vordach'), ['delegate']);
  assert.deepEqual(detectIntents('Danke!'), ['thanks']);
  assert.deepEqual(detectIntents('Das Wetter ist schön'), []);
});

test('el estado refleja lo que hace el agente en la simulación', () => {
  assert.equal(composeReply(ctx('Status?'), m), m.replies.statusIdle);
  const working = composeReply(ctx('Woran arbeitest du?', { agent: agent({ state: 'working', taskIndex: 0 }) }), m);
  assert.equal(working, `Ich arbeite gerade an: «${m.sim.tasks.bauleitung[0]}».`);
  const waiting = composeReply(ctx('Status', { agent: agent({ state: 'waiting', taskIndex: 1 }) }), m);
  assert.match(waiting, /Freigabe/);
});

test('los números salen de MethaDesk (o se dice que no hay)', () => {
  assert.equal(
    composeReply(ctx('Wie stehen die Zahlen in MethaDesk?'), m),
    'In MethaDesk sehe ich für Bauleitung: 3 von 9 Teilsystemen offen, 1 Montagen überfällig und 2 in Nachbearbeitung.',
  );
  assert.equal(composeReply(ctx('Zahlen?', { kpis: { kind: 'unit', hasData: false, open: 0, total: 0, overdue: 0, rework: 0 } }), m), 'Für Bauleitung liegen in MethaDesk noch keine Daten vor.');
  assert.equal(composeReply(ctx('Zahlen?', { kpis: { kind: 'unavailable' } }), m), m.replies.kpisUnavailable);
  const chief = composeReply(ctx('Kennzahlen bitte', { agentId: 'chief', agent: agent({ id: 'chief', kind: 'orchestrator', unitId: null }), kpis: { kind: 'all', overdue: 4, rework: 7 } }), m);
  assert.match(chief, /4 überfällige Montagen und 7 Nachbearbeitungen/);
});

test('ayuda con sus responsabilidades y delegación según la jerarquía', () => {
  assert.match(composeReply(ctx('Hilfe'), m), /Leitet die Baustellen, Plant Abrufe und Montagetermine, Koordiniert mit Produktion \/ AVOR/);
  assert.match(composeReply(ctx('Übernimm bitte die Abrufe'), m), /mit Bau und Produktion \/ AVOR ab/);
  const chief = composeReply(ctx('Erledige den Auftrag', { agentId: 'chief', agent: agent({ id: 'chief', kind: 'orchestrator', unitId: null }) }), m);
  assert.match(chief, /an Produktion \/ AVOR und Projektleitung/);
  const alone = composeReply(ctx('Mach den Auftrag', { agentId: 'bau', agent: agent({ id: 'bau', unitId: 'bau' }) }), m);
  assert.equal(alone, m.replies.delegateAlone);
});

test('los especialistas responden con su papel y la unidad para la que trabajan', () => {
  const bim = ctx('Was kannst du? Und wie sind die Zahlen?', { agentId: 'bim', agent: agent({ id: 'bim', kind: 'specialist', unitId: 'projektleitung' }), kpis: { kind: 'specialist' } });
  const reply = composeReply(bim, m);
  assert.match(reply, /Koordiniert Modelle/);
  assert.match(reply, /Arbeitet im Auftrag von Projektleitung/);
  assert.match(reply, /mit den Daten von Projektleitung/);
});

test('saludo, agradecimiento, respuesta por defecto y adjuntos', () => {
  assert.equal(composeReply(ctx('Hallo'), m), 'Grüezi! Hier ist Bauleitung. Wie kann ich helfen?');
  assert.equal(composeReply(ctx('Hallo, Status?'), m), `Grüezi, hier ist Bauleitung. ${m.replies.statusIdle}`);
  assert.equal(composeReply(ctx('Merci vielmal'), m), m.replies.thanks);
  assert.equal(composeReply(ctx('Das Wetter ist schön'), m), m.replies.fallback);
  const withFiles = composeReply(ctx('Hier der Plan', { attachments: [{ name: 'plan.pdf', size: 1200 }, { name: 'foto.jpg', size: 900 }] }), m);
  assert.match(withFiles, /2 Anhang\/Anhänge \(plan\.pdf, foto\.jpg\)/);
});
