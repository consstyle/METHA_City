import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { advance, createMission, decidePlan, PLANNING_MS } from '../missions/mission';
import { planSteps } from '../missions/planner';
import { board, createTask, missionCards, moveTask, neighbour, removeTask, TasksStateSchema } from './tasks';

const m = getMessages();
const T0 = new Date('2026-10-22T08:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);
const INPUT = { objective: 'Material für das Vordach bestellen', expected: '', length: 'kurz' as const };

test('tareas manuales: crear arriba en «Offen», mover, borrar, sin mutar', () => {
  const empty = { tasks: [] };
  const s = createTask(empty, { title: '  Lieferschein prüfen ', agentId: 'werkhof' }, T0, 't1');
  assert.deepEqual([s.tasks[0]!.title, s.tasks[0]!.status, s.tasks[0]!.agentId], ['Lieferschein prüfen', 'offen', 'werkhof']);
  assert.deepEqual(empty.tasks, []);
  const moved = moveTask(s, 't1', 'in-arbeit', after(1000));
  assert.equal(moved.tasks[0]!.status, 'in-arbeit');
  assert.equal(moved.tasks[0]!.updatedAt, after(1000).toISOString());
  assert.equal(moveTask(moved, 't1', 'in-arbeit', after(2000)).tasks[0]!.updatedAt, after(1000).toISOString(), 'misma columna: sin cambios');
  assert.deepEqual(removeTask(moved, 't1').tasks, []);
  assert.throws(() => createTask(empty, { title: '   ', agentId: null }, T0, 'x'), /required/);
  assert.ok(TasksStateSchema.safeParse(moved).success);
});

test('vecinos de columna para mover con el teclado', () => {
  assert.equal(neighbour('offen', -1), null);
  assert.equal(neighbour('offen', 1), 'in-arbeit');
  assert.equal(neighbour('erledigt', 1), null);
});

test('los pasos de una misión aparecen solos y siguen su estado', () => {
  const planning = createMission('m1', INPUT, T0, planSteps(INPUT.objective, [], m), null);
  assert.deepEqual(missionCards([planning]).map((c) => c.status), ['in-arbeit'], 'mientras planifica solo el paso del Chief');
  const waiting = advance(planning, after(PLANNING_MS), m).mission;
  assert.deepEqual(missionCards([waiting]).map((c) => c.status), ['erledigt', 'wartet', 'wartet', 'wartet']);
  const running = decidePlan(waiting, true, after(PLANNING_MS)).mission;
  assert.deepEqual(missionCards([running]).map((c) => c.status), ['erledigt', 'in-arbeit', 'offen', 'offen']);
  const result = advance(running, after(60_000), m).mission;
  assert.equal(missionCards([result]).at(-1)!.status, 'wartet', 'el informe espera la Freigabe');
  assert.deepEqual(missionCards([decidePlan(waiting, false, T0).mission]), [], 'rechazadas no aparecen');
});

test('el tablero junta tareas manuales y de misión por columna', () => {
  const s = createTask({ tasks: [] }, { title: 'Eigene Aufgabe', agentId: null }, T0, 't1');
  const mission = createMission('m1', INPUT, T0, planSteps(INPUT.objective, [], m), null);
  const b = board(s, [mission]);
  assert.deepEqual(b.offen.map((c) => c.title), ['Eigene Aufgabe']);
  assert.equal(b['in-arbeit'][0]!.missionId, 'm1');
  assert.deepEqual([b.wartet, b.erledigt], [[], []]);
});
