import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { pickAgents, planSteps } from './planner';

const m = getMessages();

test('el Chief elige unidades por palabras clave del objetivo', () => {
  assert.deepEqual(pickAgents('Überfällige Montagen auf der Baustelle reduzieren', []), ['bauleitung', 'bau']);
  assert.deepEqual(pickAgents('Materialbestellung für das Vordach klären', []), ['einkauf', 'werkhof']);
  assert.deepEqual(pickAgents('Fertigung in der Schlosserei beschleunigen', []), ['avor', 'schlosserei', 'blech']);
  assert.deepEqual(pickAgents('Etwas ganz anderes', []), ['avor', 'projektleitung'], 'por defecto, las dos cabeceras');
});

test('añade especialistas contratados que encajan, como máximo 4 agentes', () => {
  assert.deepEqual(pickAgents('Kosten und Termine der Montage prüfen', ['controlling', 'terminplanung']), ['bauleitung', 'bau', 'terminplanung', 'controlling']);
  assert.deepEqual(pickAgents('Kosten prüfen', []), ['avor', 'projektleitung'], 'sin contratar no se usan');
  assert.equal(pickAgents('Montage Material Fertigung Bericht Kosten', ['controlling']).length, 4);
});

test('el plan: análisis del Chief, un paso por agente y el informe final del Chief', () => {
  const steps = planSteps('Überfällige Montagen reduzieren', [], m);
  assert.deepEqual(steps.map((s) => [s.kind, s.agentId]), [['plan', 'chief'], ['work', 'bauleitung'], ['work', 'bau'], ['report', 'chief']]);
  assert.ok(steps.every((s) => s.status === 'pending' && s.startedAt === null));
  assert.match(steps[0]!.text, /«Überfällige Montagen reduzieren»/);
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
});

test('los textos acortan objetivos largos y los especialistas usan su papel', () => {
  const long = 'Montage '.repeat(20).trim();
  const steps = planSteps(long, [], m);
  assert.ok(steps.every((s) => s.text.length <= 140), 'textos acotados');
  const spec = planSteps('Vertrag für die Montage prüfen', ['recht'], m).find((s) => s.agentId === 'recht')!;
  assert.match(spec.text, /^Recht & Verträge:/);
});
