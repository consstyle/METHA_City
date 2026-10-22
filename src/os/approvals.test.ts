import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import { collectApprovals, pendingCount } from './approvals';
import { decide, EMPTY_HIRING, pendingApprovals, requestHire } from './hiring';
import { advance, createMission, decidePlan, decideResult, PLANNING_MS } from './missions/mission';
import { planSteps } from './missions/planner';

const m = getMessages();
const T0 = new Date('2026-10-22T08:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);
const INPUT = { objective: 'Montagen planen', expected: '', length: 'kurz' as const };

test('reúne planes, resultados y contrataciones; pendientes por antigüedad y verlauf por decisión', () => {
  const waiting = advance(createMission('m1', INPUT, T0, planSteps(INPUT.objective, [], m), null), after(PLANNING_MS), m).mission;
  const hiring = requestHire(EMPTY_HIRING, 'bim', after(10_000));
  const { pending, history } = collectApprovals(hiring, [waiting], m);
  assert.deepEqual(pending.map((p) => [p.source, p.title]), [['plan', 'Plan für «Montagen planen»'], ['hire', 'BIM-Koordination einstellen']]);
  assert.match(pending[0]!.detail, /4 Schritte mit Bauleitung, Bau/);
  assert.deepEqual(history, []);
  assert.equal(pendingCount(hiring, [waiting]), 2);

  const running = decidePlan(waiting, true, after(20_000)).mission;
  const result = advance(running, after(80_000), m).mission;
  const done = decideResult(result, false, after(90_000), m).mission;
  const decidedHiring = decide(hiring, pendingApprovals(hiring)[0]!.id, true, after(30_000));
  const later = collectApprovals(decidedHiring, [done], m);
  assert.deepEqual(later.pending, []);
  assert.deepEqual(later.history.map((h) => [h.source, h.status]), [['result', 'rejected'], ['hire', 'approved'], ['plan', 'approved']]);
  assert.equal(new Set(later.history.map((h) => h.id)).size, 3);
  assert.equal(pendingCount(decidedHiring, [done]), 0);
});
