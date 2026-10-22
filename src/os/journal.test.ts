import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { decide, EMPTY_HIRING, pendingApprovals, requestHire } from './hiring';
import { appendJournal, hiringJournal, JOURNAL_LIMIT, JournalStateSchema, missionJournal } from './journal';
import { advance, cancelMission, createMission, decidePlan, PLANNING_MS } from './missions/mission';
import { planSteps } from './missions/planner';

const m = getMessages();
const T0 = new Date('2026-10-22T08:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);
const INPUT = { objective: 'Montagen planen', expected: '', length: 'kurz' as const };

test('misiones: creación, plan listo, decisión y cancelación entran en el diario', () => {
  const created = createMission('m1', INPUT, T0, planSteps(INPUT.objective, [], m), null);
  assert.deepEqual(missionJournal([], [created], m).map((e) => e.text), ['Mission angelegt: «Montagen planen»']);
  const waiting = advance(created, after(PLANNING_MS), m).mission;
  assert.deepEqual(missionJournal([created], [waiting], m).map((e) => e.kind), ['mission', 'approval']);
  assert.match(missionJournal([created], [waiting], m)[0]!.text, /^Methabau Chief hat erledigt: Auftrag/);
  const running = decidePlan(waiting, true, after(5000)).mission;
  assert.deepEqual(missionJournal([waiting], [running], m).map((e) => e.text), ['Plan für «Montagen planen» genehmigt']);
  assert.deepEqual(missionJournal([running], [running], m), [], 'sin cambios no hay entradas');
  assert.deepEqual(missionJournal([running], [cancelMission(running, after(6000))], m).map((e) => e.kind), ['mission']);
});

test('contrataciones: solicitud y decisión', () => {
  const requested = requestHire(EMPTY_HIRING, 'bim', T0);
  assert.deepEqual(hiringJournal(EMPTY_HIRING, requested, m).map((e) => e.text), ['BIM-Koordination: Einstellung angefragt']);
  const approved = decide(requested, pendingApprovals(requested)[0]!.id, true, after(1000));
  const entries = hiringJournal(requested, approved, m);
  assert.deepEqual(entries.map((e) => [e.text, e.at, e.agentId]), [['BIM-Koordination eingestellt', after(1000).toISOString(), 'bim']]);
});

test('appendJournal no duplica, ordena por fecha y limita el tamaño', () => {
  const requested = requestHire(EMPTY_HIRING, 'bim', T0);
  const once = appendJournal([], hiringJournal(EMPTY_HIRING, requested, m));
  assert.equal(appendJournal(once, hiringJournal(EMPTY_HIRING, requested, m)).length, 1, 'la misma diferencia dos veces');
  const many = Array.from({ length: JOURNAL_LIMIT + 5 }, (_, i) => ({ id: `e${i}`, at: after(i * 1000).toISOString(), kind: 'mission' as const, agentId: null, text: 'x' }));
  const capped = appendJournal([], many);
  assert.equal(capped.length, JOURNAL_LIMIT);
  assert.equal(capped[0]!.id, `e${JOURNAL_LIMIT + 4}`, 'la más reciente primero');
  assert.ok(JournalStateSchema.safeParse({ entries: capped }).success);
});
