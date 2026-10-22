import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { SPECIALISTS } from '@/features/city/model/specialists';
import { getMessages } from '@/i18n';
import { TASKS_PER_AGENT } from '../simulation/engine';
import { agentName, taskText } from '../format';
import { profileOf } from './profile';

const m = getMessages();
const ALL = [ORCHESTRATOR_AGENT, ...CAMPUS_UNITS.map((u) => u.agent ?? u.id), ...SPECIALISTS.map((s) => s.id)];

test('cada agente tiene nombre, responsabilidades, memoria, archivos y sus tareas simuladas', () => {
  for (const id of ALL) {
    const p = profileOf(id, m);
    assert.notEqual(agentName(id, m), id, `${id} sin nombre`);
    assert.ok(p.responsibilities.length >= 3, `${id} sin responsabilidades`);
    assert.ok(p.memory.length >= 2, `${id} sin memoria`);
    assert.ok(p.files.length >= 1, `${id} sin archivos`);
    for (let i = 0; i < TASKS_PER_AGENT; i++) assert.ok(taskText(id, i, m), `${id} sin tarea ${i}`);
    for (const t of [...p.responsibilities, ...p.memory]) assert.doesNotMatch(t, /\{\w+\}/, `${id}: variable sin sustituir`);
  }
});

test('el tipo distingue orquestador, unidad y especialista', () => {
  assert.equal(profileOf('chief', m).kind, 'orchestrator');
  assert.equal(profileOf('blech', m).kind, 'unit');
  const bim = profileOf('bim', m);
  assert.equal(bim.kind, 'specialist');
  assert.equal(bim.responsibilities[1], 'Arbeitet im Auftrag von Planer');
});

test('los nombres de archivo no llevan espacios ni barras', () => {
  assert.deepEqual(profileOf('avor', m).files, ['Wochenbericht_Produktion-AVOR.pdf', 'Aufgabenliste_Produktion-AVOR.xlsx']);
  assert.deepEqual(profileOf('kalkulation', m).files, ['Wochenbericht_Kalkulation_Offerten.pdf']);
});

test('un id desconocido no rompe nada', () => {
  const p = profileOf('nope', m);
  assert.deepEqual([p.responsibilities, p.memory], [[], []]);
});
