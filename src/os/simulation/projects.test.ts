import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { getMessages } from '@/i18n';
import { profileOf } from '../chat/profile';
import { agentName, agentTaskText, taskText } from '../format';
import { createSimulation, delegationTargets, step } from './engine';
import { projectLinks, syncProjectAgents, type ProjectTeam } from './roster';

const RELATIONS = deriveRelations(CAMPUS_UNITS);
const T0 = new Date('2026-10-22T08:00:00Z');
const at = (tick: number) => new Date(T0.getTime() + tick * 2_500);
const m = getMessages();
const TEAMS: ProjectTeam[] = [
  { projektId: 'p1', agents: { pl: 'pl-dev-001', bl: 'bl-dev-001' } },
  { projektId: 'p2', agents: { pl: 'pl-dev-002', bl: 'bl-dev-002' } },
];

test('cada proyecto activo aporta su Projektleitung y su Bauleitung; al archivarse desaparecen', () => {
  const base = createSimulation(1, T0);
  const s = syncProjectAgents(base, TEAMS);
  const project = s.agents.filter((a) => a.kind === 'project');
  assert.deepEqual(project.map((a) => [a.id, a.projectId]), [['pl-dev-001', 'p1'], ['bl-dev-001', 'p1'], ['pl-dev-002', 'p2'], ['bl-dev-002', 'p2']]);
  assert.equal(base.agents.some((a) => a.kind === 'project'), false, 'no muta');
  assert.equal(syncProjectAgents(s, TEAMS), s, 'sin cambios devuelve el mismo estado');
  const one = syncProjectAgents(s, TEAMS.slice(0, 1));
  assert.deepEqual(one.agents.filter((a) => a.kind === 'project').map((a) => a.id), ['pl-dev-001', 'bl-dev-001']);
  const moved = syncProjectAgents(s, [{ ...TEAMS[0]!, projektId: 'p1-neu' }, TEAMS[1]!]);
  assert.equal(moved.agents.find((a) => a.id === 'bl-dev-001')?.projectId, 'p1-neu', 'mismo número con otro projektId: se actualiza');
});

test('delegación: Chief → AVOR y cada Projektleitung; Projektleitung → su Bauleitung; AVOR ↔ cada Bauleitung', () => {
  const links = projectLinks(TEAMS);
  assert.deepEqual(delegationTargets('chief', RELATIONS, links), ['avor', 'pl-dev-001', 'pl-dev-002']);
  assert.deepEqual(delegationTargets('pl-dev-001', RELATIONS, links), ['bl-dev-001']);
  assert.ok(delegationTargets('avor', RELATIONS, links).includes('bl-dev-002'));
  assert.deepEqual(delegationTargets('bl-dev-001', RELATIONS, links), ['avor']);
});

test('los agentes de proyecto trabajan en la simulación con las tareas de su papel', () => {
  let s = syncProjectAgents(createSimulation(9, T0), TEAMS);
  const links = projectLinks(TEAMS);
  for (let i = 1; i <= 300; i++) s = step(s, at(i), RELATIONS, links);
  const seen = new Set(s.activity.flatMap((e) => [e.agentId, e.targetAgentId]));
  assert.ok(['pl-dev-001', 'bl-dev-001', 'pl-dev-002', 'bl-dev-002'].some((id) => seen.has(id)), 'aparecen en la actividad');
  assert.equal(taskText('bl-dev-001', 0, m), m.sim.tasks.bauleitung[0]);
  assert.equal(taskText('pl-dev-002', 1, m), m.sim.tasks.projektleitung[1]);
  assert.equal(agentTaskText({ id: 'bl-dev-001', taskIndex: 2, focus: null }, m), m.sim.tasks.bauleitung[2]);
});

test('nombre visible y perfil de los agentes de proyecto', () => {
  assert.equal(agentName('pl-dev-001', m), 'Projektleitung DEV-001');
  assert.equal(agentName('bl-p-24-07', m), 'Bauleitung P-24-07');
  const p = profileOf('bl-dev-001', m);
  assert.equal(p.kind, 'project');
  assert.equal(p.responsibilities[0], m.profiles.bauleitung.responsibilities[0]);
  assert.equal(profileOf('pl-dev-001', m).memory[0], m.profiles.projektleitung.memory[0]);
});
