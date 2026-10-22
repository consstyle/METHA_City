import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { createSimulation, delegationTargets, step } from './engine';
import { addSpecialist, removeAgent, specialistLinks } from './roster';

const RELATIONS = deriveRelations(CAMPUS_UNITS);
const T0 = new Date('2026-10-22T08:00:00Z');
const at = (tick: number) => new Date(T0.getTime() + tick * 2_500);

test('contratar añade un agente especialista libre que sirve a su unidad', () => {
  const base = createSimulation(3, T0);
  const s = addSpecialist(base, 'bim');
  const bim = s.agents.find((a) => a.id === 'bim');
  assert.deepEqual(
    { kind: bim?.kind, unitId: bim?.unitId, state: bim?.state },
    { kind: 'specialist', unitId: 'planer', state: 'idle' },
  );
  assert.equal(base.agents.length, 7, 'no muta (Chief y las 6 unidades del campus)');
  assert.equal(addSpecialist(s, 'bim'), s, 'contratar dos veces no cambia nada');
  assert.throws(() => addSpecialist(base, 'nope'), /unknown specialist/);
});

test('retirar quita el agente y recalcula los recuentos', () => {
  let s = addSpecialist(createSimulation(3, T0), 'recht');
  s = { ...s, agents: s.agents.map((a) => (a.id === 'recht' ? { ...a, state: 'waiting' as const } : a)), approvalsPending: 1, tasksOpen: 1 };
  const r = removeAgent(s, 'recht');
  assert.equal(r.agents.some((a) => a.id === 'recht'), false);
  assert.equal(r.approvalsPending, 0);
  assert.equal(r.tasksOpen, 0);
  assert.throws(() => removeAgent(s, 'chief'), /only specialists/);
});

test('la unidad delega en sus especialistas, y estos trabajan con sus propias tareas', () => {
  const links = specialistLinks(['bim', 'kalkulation']);
  assert.deepEqual(links, [{ from: 'planer', to: 'bim' }, { from: 'avor', to: 'kalkulation' }]);
  assert.ok(delegationTargets('planer', RELATIONS, links).includes('bim'));
  assert.ok(!delegationTargets('werkhof', RELATIONS, links).includes('bim'));

  let s = addSpecialist(addSpecialist(createSimulation(7, T0), 'bim'), 'kalkulation');
  const seen = new Set<string>();
  for (let i = 1; i <= 400; i++) {
    s = step(s, at(i), RELATIONS, links);
    for (const e of s.activity) if (e.type === 'delegated' && (e.targetAgentId === 'bim' || e.targetAgentId === 'kalkulation')) seen.add(e.agentId);
  }
  assert.deepEqual([...seen].sort(), ['avor', 'planer'], 'solo su unidad les delega');
  assert.ok(s.activity.some((e) => e.agentId === 'bim' || e.agentId === 'kalkulation'), 'los especialistas trabajan');
});
