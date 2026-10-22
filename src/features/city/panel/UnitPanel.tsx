'use client';

import { CAMPUS_COORDINATION, CAMPUS_UNITS } from '@/features/city/model/campus';
import { childrenOf, unitById } from '@/features/city/model/hierarchy';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { SnapshotResult } from '@/data/load';
import type { MockScenario } from '@/data/mock/scenarios';
import { format, type Messages } from '@/i18n';
import { AgentSection } from './AgentSection';
import { CockpitSummary } from './CockpitSummary';
import { FlowFeed } from './FlowFeed';
import { MethadeskSection } from './MethadeskSection';
import { StructureTree } from './StructureTree';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const BUILDING_ICON = (
  <svg className="ico" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M4 28V12l11-5v21 M15 28V3l13 6v19 M2 28h28 M8 14v2 M8 20v2 M20 10v2 M24 12v2 M20 17v2 M24 19v2 M20 24v4" />
  </svg>
);

/** Panel lateral de preview.html, ampliado con el agente de la unidad y sus datos de MethaDesk. */
export function UnitPanel({ m, result, scenario }: Props) {
  const store = useCityStoreApi();
  const selected = useCity((s) => s.selected);
  const unit = unitById(CAMPUS_UNITS, selected) ?? CAMPUS_UNITS[0]!;
  const parent = unit.parent ? unitById(CAMPUS_UNITS, unit.parent) : undefined;
  const children = childrenOf(CAMPUS_UNITS, unit.id);
  const statuses = result.ok ? result.snapshot.units : [];
  const status = statuses.find((s) => s.unitId === unit.id);
  const bridge = CAMPUS_COORDINATION[0];

  return (
    <>
      <CockpitSummary m={m} />
      <div className="aside-top">
        {m.panel.explore} <b>{unit.code} / {pad2(CAMPUS_UNITS.length)}</b>
      </div>
      <div className="panel-hero">
        <div className="building-symbol">{BUILDING_ICON}</div>
        <div>
          <h2>{unit.name}</h2>
          <small>{m.panel.district} · {m.districts[unit.district].toUpperCase()}</small>
        </div>
      </div>
      <span className="role">{m.units[unit.id].role}</span>
      <p className="description">{m.units[unit.id].description}</p>
      {parent && (
        <div className="relation">
          {m.panel.dependsOn}
          <button type="button" onClick={() => store.getState().select(parent.id)}>{parent.name} ↗</button>
        </div>
      )}
      {children.length > 0 && (
        <div className="relation">
          {m.panel.children} <span>{pad2(children.length)}</span>
        </div>
      )}
      <AgentSection m={m} agentId={unit.agent ?? unit.id} />
      <MethadeskSection m={m} result={result} scenario={scenario} status={status} />
      <FlowFeed m={m} />
      <h3 className="section-label">{m.panel.structure}</h3>
      <StructureTree m={m} statuses={statuses} />
      {bridge && (
        <div className="bridge-card">
          <div className="bridge-badge">↔ &nbsp; {m.panel.bridgeBadge}</div>
          <p>{format(m.panel.bridgeText, { a: unitById(CAMPUS_UNITS, bridge.from)?.name ?? '', b: unitById(CAMPUS_UNITS, bridge.to)?.name ?? '' })}</p>
        </div>
      )}
      <button type="button" className="focus-btn" onClick={() => store.getState().focus(unit.id)}>
        {BUILDING_ICON}
        {m.panel.focus}
      </button>
      <p className="note">{m.panel.note}</p>
    </>
  );
}
