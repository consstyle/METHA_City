import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { MissionSchema } from './contract';
import {
  advance, cancelMission, canRevise, createMission, decidePlan, decideResult, MAX_STEPS, PLANNING_MS, pinsOf, progress, STEP_MS,
} from './mission';
import { planSteps } from './planner';

const m = getMessages();
const T0 = new Date('2026-10-22T08:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);
const INPUT = { objective: 'Überfällige Montagen reduzieren', expected: 'Liste mit Massnahmen', length: 'ausfuehrlich' as const };
const CONTEXT = { hasData: true, open: 12, total: 40, overdue: 3, rework: 2 };
const fresh = () => createMission('m1', INPUT, T0, planSteps(INPUT.objective, [], m), CONTEXT);

test('al crearla el Chief planifica; tras el tiempo de planificación el plan espera Freigabe', () => {
  const created = fresh();
  assert.equal(created.status, 'planning');
  assert.deepEqual(pinsOf([created]), { chief: created.steps[0]!.text });
  assert.equal(advance(created, after(PLANNING_MS - 1), m).mission, created, 'sin cambios antes de tiempo');
  const { mission } = advance(created, after(PLANNING_MS), m);
  assert.equal(mission.status, 'awaiting-plan');
  assert.equal(mission.awaitingSince, after(PLANNING_MS).toISOString());
  assert.deepEqual(pinsOf([mission]), {}, 'mientras espera nadie está ocupado');
  assert.ok(MissionSchema.safeParse(mission).success);
});

test('plan aprobado: los pasos se ejecutan uno tras otro y encienden la delegación', () => {
  const ready = advance(fresh(), after(PLANNING_MS), m).mission;
  const approved = decidePlan(ready, true, after(PLANNING_MS + 1000));
  assert.equal(approved.mission.status, 'running');
  // Se delega por la jerarquía: Projektleitung → Bauleitung enciende esa ruta de la ciudad.
  assert.deepEqual(approved.events.map((e) => [e.type, e.agentId, e.targetAgentId]), [['delegated', 'projektleitung', 'bauleitung']]);
  assert.deepEqual(pinsOf([approved.mission]), { bauleitung: approved.mission.steps[1]!.text });

  const t1 = PLANNING_MS + 1000 + STEP_MS;
  const second = advance(approved.mission, after(t1), m);
  assert.deepEqual(second.mission.steps.map((s) => s.status), ['done', 'done', 'working', 'pending']);
  assert.deepEqual(second.events.map((e) => e.type), ['completed', 'delegated']);
  assert.deepEqual(progress(second.mission), { done: 2, total: 4 });
});

test('si pasa mucho tiempo (recarga) se ponen al día todos los pasos y queda el informe en borrador', () => {
  const ready = advance(fresh(), after(PLANNING_MS), m).mission;
  const running = decidePlan(ready, true, after(PLANNING_MS)).mission;
  const { mission, events } = advance(running, after(PLANNING_MS + 10 * STEP_MS), m);
  assert.equal(mission.status, 'awaiting-result');
  assert.ok(mission.steps.every((s) => s.status === 'done'));
  assert.equal(mission.steps.at(-1)!.finishedAt, after(PLANNING_MS + 3 * STEP_MS).toISOString(), 'tiempos reales de cada paso');
  assert.ok(events.length >= 5);
  assert.match(mission.report!, /^# Bericht: Überfällige Montagen reduzieren/);
  assert.match(mission.report!, /12 von 40 Teilsystemen offen/);
});

test('resultado aprobado cierra la misión; rechazado añade una revisión del Chief y vuelve a pedir Freigabe', () => {
  const ready = advance(fresh(), after(PLANNING_MS), m).mission;
  const waiting = advance(decidePlan(ready, true, after(PLANNING_MS)).mission, after(60_000), m).mission;
  const done = decideResult(waiting, true, after(61_000), m).mission;
  assert.equal(done.status, 'done');
  assert.deepEqual(done.decisions.map((d) => [d.kind, d.approve]), [['plan', true], ['result', true]]);

  const revising = decideResult(waiting, false, after(61_000), m);
  assert.equal(revising.mission.status, 'running');
  assert.deepEqual([revising.mission.steps.at(-1)!.kind, revising.mission.steps.at(-1)!.status], ['revision', 'working']);
  assert.equal(revising.mission.report, null);
  const again = advance(revising.mission, after(61_000 + STEP_MS), m).mission;
  assert.equal(again.status, 'awaiting-result');
  assert.match(again.report!, /Überarbeitet nach 1 Rückmeldung/);
});

test('rechazar el plan o cancelar detienen la misión; las transiciones inválidas fallan', () => {
  const ready = advance(fresh(), after(PLANNING_MS), m).mission;
  assert.equal(decidePlan(ready, false, after(PLANNING_MS)).mission.status, 'rejected');
  const cancelled = cancelMission(ready, after(PLANNING_MS));
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(pinsOf([cancelled]), {});
  const running = decidePlan(ready, true, after(PLANNING_MS)).mission;
  const stopped = cancelMission(running, after(PLANNING_MS + 1000));
  assert.equal(stopped.steps.some((s) => s.status === 'working'), false, 'nadie sigue «trabajando»');
  assert.deepEqual(pinsOf([stopped]), {});
  assert.throws(() => decidePlan(fresh(), true, T0), /not awaiting/);
  assert.throws(() => decideResult(ready, true, T0, m), /not awaiting/);
  assert.throws(() => cancelMission(cancelled, T0), /finished/);
  assert.equal(advance(cancelled, after(99_000), m).mission, cancelled);
});

test('las revisiones tienen un límite y canRevise lo dice antes de pulsar', () => {
  let current = advance(decidePlan(advance(fresh(), after(PLANNING_MS), m).mission, true, after(PLANNING_MS)).mission, after(60_000), m).mission;
  let t = 60_000;
  while (canRevise(current)) {
    t += 1000;
    current = decideResult(current, false, after(t), m).mission;
    t += STEP_MS;
    current = advance(current, after(t), m).mission;
  }
  assert.equal(current.steps.length, MAX_STEPS);
  assert.equal(current.status, 'awaiting-result');
  assert.throws(() => decideResult(current, false, after(t + 1), m), /no room/);
  assert.equal(decideResult(current, true, after(t + 1), m).mission.status, 'done');
});

test('las cabeceras y los especialistas reciben el trabajo del Chief o de su unidad', () => {
  const steps = planSteps('Vertrag für das Projekt prüfen', ['recht'], m);
  const ready = advance(createMission('m3', { ...INPUT, objective: 'Vertrag für das Projekt prüfen' }, T0, steps, null), after(PLANNING_MS), m).mission;
  const run = decidePlan(ready, true, after(PLANNING_MS));
  assert.deepEqual(run.events.map((e) => [e.agentId, e.targetAgentId]), [['chief', 'projektleitung']]);
  const next = advance(run.mission, after(PLANNING_MS + STEP_MS), m);
  assert.deepEqual(next.events.at(-1) && [next.events.at(-1)!.agentId, next.events.at(-1)!.targetAgentId], ['projektleitung', 'recht']);
});

test('si el reloj retrocede, la misión no se congela', () => {
  const ready = advance(fresh(), after(PLANNING_MS), m).mission;
  const running = decidePlan(ready, true, after(10 * 60_000)).mission;
  const rebased = advance(running, after(STEP_MS), m).mission;
  assert.equal(rebased.steps[1]!.startedAt, after(STEP_MS).toISOString(), 'el paso cuenta desde ahora');
  assert.equal(advance(rebased, after(2 * STEP_MS), m).mission.steps[1]!.status, 'done', 'y termina a su tiempo');
});

test('informes corto y medio: menos secciones', () => {
  const run = (length: 'kurz' | 'mittel') => {
    const created = createMission('m2', { ...INPUT, length }, T0, planSteps(INPUT.objective, [], m), null);
    const ready = advance(created, after(PLANNING_MS), m).mission;
    return advance(decidePlan(ready, true, after(PLANNING_MS)).mission, after(60_000), m).mission.report!;
  };
  assert.doesNotMatch(run('kurz'), /## Vorgehen/);
  assert.match(run('mittel'), /## Vorgehen/);
  assert.doesNotMatch(run('mittel'), /## Kennzahlen/);
});
