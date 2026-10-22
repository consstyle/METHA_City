import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { pickAgents, planSteps, type PlannerProject } from './planner';

const m = getMessages();
const PROJECTS: PlannerProject[] = [
  { projektnummer: 'DEV-001', projektname: 'GAZ Ausbildungszentrum, Beringen', agents: { pl: 'pl-dev-001', bl: 'bl-dev-001' } },
  { projektnummer: 'DEV-002', projektname: 'Innloc AG, Rothenburg', agents: { pl: 'pl-dev-002', bl: 'bl-dev-002' } },
];

test('el Chief elige edificios del campus por palabras clave del objetivo', () => {
  assert.deepEqual(pickAgents('Materialbestellung für das Vordach klären', [], PROJECTS), ['einkauf', 'werkhof']);
  assert.deepEqual(pickAgents('Fertigung in der Schlosserei beschleunigen', [], PROJECTS), ['avor', 'schlosserei', 'blech']);
  assert.deepEqual(pickAgents('Neue Zeichnungen für die Treppe', [], PROJECTS), ['planer']);
  assert.deepEqual(pickAgents('Etwas ganz anderes', [], PROJECTS), ['avor', 'planer'], 'por defecto, AVOR y Planer');
});

test('lo de obra va al equipo de cada proyecto; si se nombra un proyecto, solo a ese', () => {
  assert.deepEqual(pickAgents('Überfällige Montagen auf den Baustellen reduzieren', [], PROJECTS), ['bl-dev-001', 'bl-dev-002']);
  assert.deepEqual(pickAgents('Montagen bei Innloc beschleunigen', [], PROJECTS), ['bl-dev-002']);
  assert.deepEqual(pickAgents('Risikobericht für DEV-002 erstellen', [], PROJECTS), ['pl-dev-002']);
  assert.deepEqual(pickAgents('Überfällige Montagen reduzieren', [], []), ['avor', 'planer'], 'sin proyectos activos');
  const many = [...PROJECTS, { projektnummer: 'DEV-003', projektname: 'BB20, Wädenswil', agents: { pl: 'pl-dev-003', bl: 'bl-dev-003' } }];
  assert.deepEqual(pickAgents('Montage-Material bestellen', [], many), ['bl-dev-001', 'bl-dev-002', 'einkauf', 'werkhof'], 'sin nombrar proyecto: como mucho 2 obras');
  assert.deepEqual(pickAgents('Status der Montage bei BB20 klären', [], many), ['bl-dev-003'], 'el nombre se reconoce aunque lleve coma');
});

test('añade especialistas contratados que encajan, como máximo 4 agentes', () => {
  assert.deepEqual(pickAgents('Kosten und Termine der Montage prüfen', ['controlling', 'terminplanung'], PROJECTS), ['bl-dev-001', 'bl-dev-002', 'terminplanung', 'controlling']);
  assert.deepEqual(pickAgents('Kosten prüfen', [], PROJECTS), ['avor', 'planer'], 'sin contratar no se usan');
  assert.equal(pickAgents('Montage Material Fertigung Bericht Kosten', ['controlling'], PROJECTS).length, 4);
});

test('el plan: análisis del Chief, un paso por agente y el informe final del Chief', () => {
  const steps = planSteps('Überfällige Montagen reduzieren', [], m, PROJECTS);
  assert.deepEqual(steps.map((s) => [s.kind, s.agentId]), [['plan', 'chief'], ['work', 'bl-dev-001'], ['work', 'bl-dev-002'], ['report', 'chief']]);
  assert.ok(steps.every((s) => s.status === 'pending' && s.startedAt === null));
  assert.match(steps[0]!.text, /«Überfällige Montagen reduzieren»/);
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
});

test('los textos acortan objetivos largos y los especialistas usan su papel', () => {
  const long = 'Montage '.repeat(20).trim();
  const steps = planSteps(long, [], m, PROJECTS);
  assert.ok(steps.every((s) => s.text.length <= 140), 'textos acotados');
  const spec = planSteps('Vertrag für die Montage prüfen', ['recht'], m, PROJECTS).find((s) => s.agentId === 'recht')!;
  assert.match(spec.text, /^Recht & Verträge:/);
});
