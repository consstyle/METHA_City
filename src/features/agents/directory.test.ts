import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, EMPTY_HIRING, pendingApprovals, requestHire, requestRetire } from '@/os/hiring';
import { createSimulation } from '@/os/simulation/engine';
import { addSpecialist } from '@/os/simulation/roster';
import { catalogStatus, districtOf, filterAgents, freeLots } from './directory';

const T = new Date('2026-10-22T09:00:00Z');

test('los filtros separan unidades (con el Chief) y especialistas, el Chief primero', () => {
  const sim = addSpecialist(createSimulation(1, T), 'bim');
  assert.equal(filterAgents(sim.agents, 'all').length, 10);
  assert.equal(filterAgents(sim.agents, 'all')[0]!.id, 'chief');
  assert.equal(filterAgents(sim.agents, 'all').at(-1)!.id, 'bim');
  assert.equal(filterAgents(sim.agents, 'units').length, 9);
  assert.deepEqual(filterAgents(sim.agents, 'specialists').map((a) => a.id), ['bim']);
});

test('distrito de un agente según su unidad; el Chief no tiene', () => {
  assert.equal(districtOf({ unitId: 'bau' }), 'project');
  assert.equal(districtOf({ unitId: 'werkhof' }), 'industrial');
  assert.equal(districtOf({ unitId: null }), null);
});

test('estado de cada papel del catálogo a lo largo de su ciclo', () => {
  let h = EMPTY_HIRING;
  assert.equal(catalogStatus(h, 'bim', 'project'), 'available');
  h = requestHire(h, 'bim', T);
  assert.equal(catalogStatus(h, 'bim', 'project'), 'pending-hire');
  h = decide(h, pendingApprovals(h)[0]!.id, true, T);
  assert.equal(catalogStatus(h, 'bim', 'project'), 'active');
  h = requestRetire(h, 'bim', T);
  assert.equal(catalogStatus(h, 'bim', 'project'), 'pending-retire');
  for (const r of ['kalkulation', 'terminplanung', 'recht']) h = requestHire(h, r, T);
  assert.deepEqual(freeLots(h), { industrial: 4, project: 0 });
  assert.equal(catalogStatus(h, 'kundendienst', 'project'), 'no-lot');
});
