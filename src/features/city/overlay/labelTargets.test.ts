import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { layoutSites } from '@/features/city/model/projects';
import { SITE_LABEL_HEIGHT } from '@/features/city/scene/builder/projectSites';
import { labelTargets } from './labelTargets';

test('sin obras se etiquetan solo los edificios del campus; AVOR es el orquestador', () => {
  const targets = labelTargets([]);
  assert.deepEqual(targets.map((t) => t.id), CAMPUS_UNITS.map((u) => u.id));
  assert.deepEqual(targets.find((t) => t.id === 'avor')?.kicker, { kind: 'orchestrator' });
  assert.deepEqual(targets.find((t) => t.id === 'werkhof')?.kicker, { kind: 'campus' });
  assert.equal(labelTargets([]), targets, 'la lista del campus se reutiliza');
});

test('cada obra lleva su etiqueta sobre la grúa, con el número de proyecto y el estado de su Projektleitung', () => {
  const [site] = layoutSites([{ projektId: 'b', projektnummer: 'DEV-002', projektname: 'Innloc AG, Rothenburg' }]);
  const t = labelTargets([site!]).at(-1)!;
  assert.deepEqual(
    { id: t.id, name: t.name, kicker: t.kicker, agentId: t.agentId, anchor: t.anchor },
    { id: 'projekt:b', name: 'Innloc AG, Rothenburg', kicker: { kind: 'site', nr: 'DEV-002' }, agentId: 'pl-dev-002', anchor: [site!.building.x, SITE_LABEL_HEIGHT, site!.building.z] },
  );
});
