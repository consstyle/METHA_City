import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import type { SimAgent } from '../simulation/engine';
import { composeReply, detectIntents, type ReplyContext } from './replies';

const m = getMessages();
const agent = (over: Partial<SimAgent> = {}): SimAgent => ({
  id: 'werkhof', kind: 'unit', unitId: 'werkhof', state: 'idle', taskIndex: null, focus: null, since: 0, busyFor: 0, lastActiveAt: null, ...over,
});
const ctx = (text: string, over: Partial<ReplyContext> = {}): ReplyContext => ({
  agentId: 'werkhof', text, attachments: [], agent: agent(), kpis: { kind: 'unit', hasData: true, open: 3, total: 9, overdue: 1, rework: 2 },
  specialists: [], ...over,
});
const TEAMS = [{ projektId: 'mock-DEV-001', agents: { pl: 'pl-dev-001', bl: 'bl-dev-001' } }];
const bauleitung = (text: string, over: Partial<ReplyContext> = {}) => ctx(text, {
  agentId: 'bl-dev-001', agent: agent({ id: 'bl-dev-001', kind: 'project', unitId: null, projectId: 'mock-DEV-001' }), teams: TEAMS, ...over,
});
const chief = agent({ id: 'chief', kind: 'orchestrator', unitId: null });

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
  assert.equal(working, `Ich arbeite gerade an: «${m.sim.tasks.werkhof[0]}».`);
  const waiting = composeReply(ctx('Status', { agent: agent({ state: 'waiting', taskIndex: 1 }) }), m);
  assert.match(waiting, /Freigabe/);
  const mission = composeReply(ctx('Status', { agent: agent({ state: 'working', focus: 'Abrufe für die Mission prüfen' }) }), m);
  assert.equal(mission, 'Ich arbeite gerade an: «Abrufe für die Mission prüfen».');
  const site = composeReply(bauleitung('Woran arbeitest du?', { agent: agent({ id: 'bl-dev-001', kind: 'project', unitId: null, state: 'working', taskIndex: 2 }) }), m);
  assert.equal(site, `Ich arbeite gerade an: «${m.sim.tasks.bauleitung[2]}».`, 'la Bauleitung de una obra usa las tareas de su papel');
});

test('los números salen de MethaDesk (o se dice que no hay)', () => {
  assert.equal(
    composeReply(ctx('Wie stehen die Zahlen in MethaDesk?'), m),
    'In MethaDesk sehe ich für Werkhof: 3 von 9 Teilsystemen offen, 1 Montagen überfällig und 2 in Nachbearbeitung.',
  );
  assert.equal(composeReply(ctx('Zahlen?', { kpis: { kind: 'unit', hasData: false, open: 0, total: 0, overdue: 0, rework: 0 } }), m), 'Für Werkhof liegen in MethaDesk noch keine Daten vor.');
  assert.equal(composeReply(ctx('Zahlen?', { kpis: { kind: 'unavailable' } }), m), m.replies.kpisUnavailable);
  const boss = composeReply(ctx('Kennzahlen bitte', { agentId: 'chief', agent: chief, kpis: { kind: 'all', overdue: 4, rework: 7 } }), m);
  assert.match(boss, /4 überfällige Montagen und 7 Nachbearbeitungen/);
  const project = composeReply(bauleitung('Zahlen?', { kpis: { kind: 'project', projekt: 'DEV-001', total: 16, verbaut: 2, overdue: 4, rework: 1 } }), m);
  assert.equal(project, 'Im Projekt DEV-001 sind 2 von 16 Teilsystemen verbaut, 4 Montagen überfällig und 1 in Nachbearbeitung.');
});

test('ayuda con sus responsabilidades y delegación según la jerarquía y los equipos de obra', () => {
  assert.match(composeReply(ctx('Hilfe'), m), /Kommissionierung und Versand, Lagerplätze und Wareneingang, Rückmeldungen an den Bau/);
  assert.equal(composeReply(ctx('Mach den Auftrag'), m), m.replies.delegateAlone, 'el Werkhof no tiene a quién delegar');
  const avor = composeReply(ctx('Übernimm bitte', { agentId: 'avor', agent: agent({ id: 'avor', unitId: 'avor' }), teams: TEAMS }), m);
  assert.match(avor, /Planer, Einkauf, Schlosserei, Blechabteilung, Werkhof und Bauleitung DEV-001/);
  assert.match(composeReply(bauleitung('Hilfe'), m), /Leitet die Baustelle des Projekts, Plant Abrufe und Montagetermine/);
  assert.match(composeReply(bauleitung('Übernimm bitte die Abrufe'), m), /stimme mich mit Produktion \/ AVOR ab/);
  const boss = composeReply(ctx('Erledige den Auftrag', { agentId: 'chief', agent: chief, teams: TEAMS }), m);
  assert.match(boss, /an Produktion \/ AVOR und Projektleitung DEV-001/);
});

test('los especialistas responden con su papel y la unidad para la que trabajan', () => {
  const bim = ctx('Was kannst du? Und wie sind die Zahlen?', { agentId: 'bim', agent: agent({ id: 'bim', kind: 'specialist', unitId: 'planer' }), kpis: { kind: 'specialist' } });
  const reply = composeReply(bim, m);
  assert.match(reply, /Koordiniert Modelle/);
  assert.match(reply, /Arbeitet im Auftrag von Planer/);
  assert.match(reply, /mit den Daten von Planer/);
});

test('saludo, agradecimiento, respuesta por defecto y adjuntos', () => {
  assert.equal(composeReply(ctx('Hallo'), m), 'Grüezi! Hier ist Werkhof. Wie kann ich helfen?');
  assert.equal(composeReply(ctx('Hallo, Status?'), m), `Grüezi, hier ist Werkhof. ${m.replies.statusIdle}`);
  assert.equal(composeReply(bauleitung('Hallo'), m), 'Grüezi! Hier ist Bauleitung DEV-001. Wie kann ich helfen?');
  assert.equal(composeReply(ctx('Merci vielmal'), m), m.replies.thanks);
  assert.equal(composeReply(ctx('Das Wetter ist schön'), m), m.replies.fallback);
  const withFiles = composeReply(ctx('Hier der Plan', { attachments: [{ name: 'plan.pdf', size: 1200 }, { name: 'foto.jpg', size: 900 }] }), m);
  assert.match(withFiles, /2 Anhang\/Anhänge \(plan\.pdf, foto\.jpg\)/);
});
