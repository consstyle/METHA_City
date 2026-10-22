import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { OsSnapshotSchema } from '../contract';
import { activeDelegations, createSimulation, delegationTargets, step, toSnapshot, ACTIVITY_LIMIT } from './engine';

const RELATIONS = deriveRelations(CAMPUS_UNITS);
const T0 = new Date('2026-10-21T08:00:00Z');
const at = (tick: number) => new Date(T0.getTime() + tick * 2_500);

function run(seed: number, ticks: number) {
  let s = createSimulation(seed, T0);
  for (let i = 1; i <= ticks; i++) s = step(s, at(i), RELATIONS);
  return s;
}

test('al empezar están el orquestador y los 8 agentes de unidad, todos libres y sin actividad', () => {
  const s = createSimulation(1, T0);
  assert.deepEqual(s.agents.map((a) => a.id), ['chief', ...CAMPUS_UNITS.map((u) => u.id)]);
  assert.ok(s.agents.every((a) => a.state === 'idle' && a.taskIndex === null));
  assert.deepEqual(s.activity, []);
});

test('la simulación es determinista: misma semilla, mismo resultado', () => {
  assert.deepEqual(run(7, 40), run(7, 40));
  assert.notDeepEqual(run(7, 40).activity, run(8, 40).activity);
});

test('step no muta el estado anterior', () => {
  const s0 = createSimulation(3, T0);
  const frozen = JSON.stringify(s0);
  step(s0, at(1), RELATIONS);
  assert.equal(JSON.stringify(s0), frozen);
});

test('con el tiempo hay trabajo, delegaciones, finalizaciones y peticiones de aprobación', () => {
  const s = run(11, 200);
  const types = new Set(s.activity.map((e) => e.type));
  for (const t of ['started', 'delegated', 'completed', 'approval']) assert.ok(types.has(t as never), `falta ${t}`);
});

test('las delegaciones siguen la jerarquía de la ciudad o la coordinación AVOR ↔ Bauleitung', () => {
  const s = run(5, 300);
  for (const e of s.activity.filter((x) => x.type === 'delegated')) {
    assert.ok(delegationTargets(e.agentId, RELATIONS).includes(e.targetAgentId as string), `${e.agentId} → ${e.targetAgentId}`);
  }
  assert.deepEqual(delegationTargets('chief', RELATIONS).sort(), ['avor', 'projektleitung']);
  assert.deepEqual(delegationTargets('avor', RELATIONS).sort(), ['bauleitung', 'blech', 'einkauf', 'schlosserei', 'werkhof']);
  assert.deepEqual(delegationTargets('bau', RELATIONS), []);
});

test('el registro se limita y los recuentos cuadran con los estados', () => {
  const s = run(2, 400);
  assert.ok(s.activity.length <= ACTIVITY_LIMIT);
  const busy = s.agents.filter((a) => a.state === 'working' || a.state === 'waiting').length;
  assert.equal(s.tasksOpen, busy);
  assert.equal(s.approvalsPending, s.agents.filter((a) => a.state === 'waiting').length);
  assert.ok(s.agents.every((a) => ['idle', 'working', 'waiting'].includes(a.state)));
});

test('ningún agente se queda trabajando ni esperando para siempre', () => {
  let s = createSimulation(9, T0);
  const since = new Map<string, number>();
  for (let i = 1; i <= 300; i++) {
    s = step(s, at(i), RELATIONS);
    for (const a of s.agents) {
      if (a.state === 'idle') since.delete(a.id);
      else if (!since.has(a.id)) since.set(a.id, i);
      else assert.ok(i - (since.get(a.id) ?? i) <= 14, `${a.id} lleva demasiado en ${a.state}`);
    }
  }
});

test('activeDelegations devuelve solo las delegaciones recientes entre unidades', () => {
  const s = run(4, 120);
  const recent = activeDelegations(s, 2);
  const lastTick = s.tick;
  const expected = s.activity
    .filter((e) => e.type === 'delegated' && e.agentId !== 'chief' && lastTick - e.tick < 2)
    .map((e) => ({ from: e.agentId, to: e.targetAgentId }));
  assert.deepEqual(recent, expected);
});

test('toSnapshot entrega un estado válido según el contrato, con fechas ISO', () => {
  const snap = toSnapshot(run(6, 60));
  assert.doesNotThrow(() => OsSnapshotSchema.parse(snap));
  assert.equal(snap.agents.length, 9);
  assert.equal(snap.source, 'simulation');
});
