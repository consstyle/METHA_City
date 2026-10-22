import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, EMPTY_HIRING, pendingApprovals, requestHire, requestRetire } from '@/os/hiring';
import { createSimulation } from '@/os/simulation/engine';
import { addSpecialist, syncProjectAgents } from '@/os/simulation/roster';
import { catalogStatus, cityPlaceOf, districtOf, filterAgents, freeLots } from './directory';

const T = new Date('2026-10-22T09:00:00Z');

const TEAM = [{ projektId: 'mock-DEV-001', agents: { pl: 'pl-dev-001', bl: 'bl-dev-001' } }];

test('los filtros separan unidades (con el Chief y los equipos de proyecto) y especialistas, el Chief primero', () => {
  const sim = addSpecialist(syncProjectAgents(createSimulation(1, T), TEAM), 'bim');
  assert.equal(filterAgents(sim.agents, 'all').length, 10);
  assert.equal(filterAgents(sim.agents, 'all')[0]!.id, 'chief');
  assert.equal(filterAgents(sim.agents, 'all').at(-1)!.id, 'bim');
  assert.deepEqual(filterAgents(sim.agents, 'units').slice(-2).map((a) => a.id), ['pl-dev-001', 'bl-dev-001'], 'proyectos tras el campus');
  assert.equal(filterAgents(sim.agents, 'units').length, 9);
  assert.deepEqual(filterAgents(sim.agents, 'specialists').map((a) => a.id), ['bim']);
});

test('distrito de un agente según su unidad; los equipos de proyecto están en las obras; el Chief no tiene', () => {
  assert.equal(districtOf({ unitId: 'werkhof' }), 'industrial');
  assert.equal(districtOf({ unitId: null, kind: 'project' }), 'project');
  assert.equal(districtOf({ unitId: null }), null);
});

test('dónde se ve un agente en la ciudad: su edificio o la obra de su proyecto', () => {
  assert.equal(cityPlaceOf({ unitId: 'werkhof', kind: 'unit', projectId: null }), 'werkhof');
  assert.equal(cityPlaceOf({ unitId: null, kind: 'project', projectId: 'mock-DEV-001' }), 'projekt:mock-DEV-001');
  assert.equal(cityPlaceOf({ unitId: null, kind: 'orchestrator' }), null);
});

test('estado de cada papel del catálogo a lo largo de su ciclo', () => {
  let h = EMPTY_HIRING;
  assert.equal(catalogStatus(h, 'bim', 'industrial'), 'available');
  h = requestHire(h, 'bim', T);
  assert.equal(catalogStatus(h, 'bim', 'industrial'), 'pending-hire');
  h = decide(h, pendingApprovals(h)[0]!.id, true, T);
  assert.equal(catalogStatus(h, 'bim', 'industrial'), 'active');
  h = requestRetire(h, 'bim', T);
  assert.equal(catalogStatus(h, 'bim', 'industrial'), 'pending-retire');
  for (const r of ['kalkulation', 'terminplanung', 'recht', 'controlling', 'personal', 'qualitaet', 'logistik']) h = requestHire(h, r, T);
  assert.deepEqual(freeLots(h), { industrial: 0, project: 0 });
  assert.equal(catalogStatus(h, 'kundendienst', 'industrial'), 'no-lot');
});
