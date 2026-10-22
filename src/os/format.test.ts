import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { getMessages } from '@/i18n';
import { activityText, agentName, taskText } from './format';
import { TASKS_PER_AGENT } from './simulation/engine';

const m = getMessages();

test('agentName usa el nombre del orquestador y el de cada unidad', () => {
  assert.equal(agentName('chief', m), 'Methabau Chief');
  assert.equal(agentName('avor', m), 'Produktion / AVOR');
  assert.equal(agentName(null, m), '');
  assert.equal(agentName('desconocido', m), 'desconocido');
});

test('cada agente tiene tantos textos de tarea como usa el motor', () => {
  for (const id of ['chief', ...CAMPUS_UNITS.map((u) => u.id)]) {
    for (let i = 0; i < TASKS_PER_AGENT; i++) assert.ok(taskText(id, i, m).length > 5, `${id}[${i}]`);
  }
  assert.equal(taskText('avor', null, m), '');
  assert.equal(taskText('desconocido', 0, m), '');
});

test('activityText compone frases en alemán con agente, destino y tarea', () => {
  const base = { id: 'x', tick: 1, at: '2026-10-21T10:00:00Z', targetAgentId: null, taskIndex: 0 };
  assert.equal(
    activityText({ ...base, type: 'started', agentId: 'werkhof' }, m),
    `Werkhof beginnt: ${taskText('werkhof', 0, m)}`,
  );
  const delegated = activityText({ ...base, type: 'delegated', agentId: 'avor', targetAgentId: 'schlosserei' }, m);
  assert.equal(delegated, `Produktion / AVOR delegiert an Schlosserei: ${taskText('schlosserei', 0, m)}`);
  assert.match(activityText({ ...base, type: 'approval', agentId: 'bau' }, m), /^Bau bittet um Freigabe: /);
});
