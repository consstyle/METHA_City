import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { getMessages } from '@/i18n';
import { ActivityEventSchema } from '../contract';
import { activityText, agentTaskText } from '../format';
import { activeDelegations, appendEvents, createSimulation, step } from './engine';

const RELATIONS = deriveRelations(CAMPUS_UNITS);
const T0 = new Date('2026-10-22T08:00:00Z');
const at = (tick: number) => new Date(T0.getTime() + tick * 2_500);
const m = getMessages();

test('un agente fijado por una misión trabaja en su paso y no recibe tareas ni delegaciones al azar', () => {
  let s = createSimulation(5, T0);
  const pins = { bau: 'Montageplan prüfen' };
  for (let i = 1; i <= 120; i++) {
    s = step(s, at(i), RELATIONS, [], pins);
    const bau = s.agents.find((a) => a.id === 'bau')!;
    assert.deepEqual([bau.state, bau.focus, bau.taskIndex], ['working', 'Montageplan prüfen', null], `tick ${i}`);
  }
  const random = s.activity.filter((e) => (e.agentId === 'bau' || e.targetAgentId === 'bau') && !e.note);
  assert.deepEqual(random, [], 'nadie le asigna trabajo del motor');
  assert.equal(agentTaskText(s.agents.find((a) => a.id === 'bau')!, m), 'Montageplan prüfen');
});

test('al soltarlo vuelve a estar libre y sin foco', () => {
  let s = step(createSimulation(5, T0), at(1), RELATIONS, [], { werkhof: 'Kommissionieren' });
  s = step(s, at(2), RELATIONS, [], {});
  const werkhof = s.agents.find((a) => a.id === 'werkhof')!;
  assert.deepEqual([werkhof.state, werkhof.focus], ['idle', null]);
});

test('una delegación de misión reciente enciende su ruta; las antiguas (tras recargar) no', () => {
  // Sin actividad propia del motor, para ver solo la delegación de la misión.
  const s = { ...createSimulation(5, T0), tick: 30, now: at(30).toISOString() };
  const recent = appendEvents(s, [{ type: 'delegated', agentId: 'projektleitung', targetAgentId: 'bauleitung', note: 'x', at: s.now }]);
  assert.deepEqual(activeDelegations(recent, 2).filter((d) => d.from === 'projektleitung'), [{ from: 'projektleitung', to: 'bauleitung' }]);
  const old = appendEvents(s, [{ type: 'delegated', agentId: 'projektleitung', targetAgentId: 'bauleitung', note: 'x', at: at(1).toISOString() }]);
  assert.deepEqual(activeDelegations(old, 2).filter((d) => d.from === 'projektleitung' && d.to === 'bauleitung'), []);
});

test('los eventos externos (misiones) se añaden al registro con su nota y valen para el contrato', () => {
  const s = appendEvents(createSimulation(5, T0), [{ type: 'delegated', agentId: 'chief', targetAgentId: 'bau', note: 'Montageplan prüfen', at: T0.toISOString() }]);
  const e = s.activity.at(-1)!;
  assert.equal(ActivityEventSchema.safeParse(e).success, true);
  assert.equal(activityText(e, m), 'Methabau Chief delegiert an Bau: Montageplan prüfen');
  assert.equal(new Set(appendEvents(s, [{ type: 'completed', agentId: 'bau', targetAgentId: null, note: 'x', at: T0.toISOString() }]).activity.map((x) => x.id)).size, 2);
});
