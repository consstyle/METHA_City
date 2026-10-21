'use client';

import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { abteilungName } from '@/features/city/model/abteilungen';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitsByDistrict } from '@/features/city/model/hierarchy';
import { DISTRICT_IDS, type UnitDef } from '@/features/city/model/types';
import type { SnapshotResult } from '@/data/load';
import type { UnitStatus } from '@/data/contract';
import type { MockScenario } from '@/data/mock/scenarios';
import { format, INTL_LOCALE, type Messages } from '@/i18n';
import { timeInZurich } from '@/lib/dates';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
}

function Badge({ n, tone, label }: Readonly<{ n: number; tone: 'r' | 'o'; label: string }>) {
  if (n <= 0) return null;
  return (
    <span className={`badge ${tone}`} title={label}>
      {n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function Kpis({ m, status }: Readonly<{ m: Messages; status: UnitStatus | undefined }>) {
  if (!status?.hasData) return <span className="no-data">{m.panel.noData}</span>;
  return (
    <span className="kpis">
      <span className="kpi-chip">{status.ts.offen}/{status.ts.total} {m.panel.open}</span>
      <Badge n={status.alerts.montageUeberfaellig} tone="r" label={m.panel.overdue} />
      <Badge n={status.alerts.nachbearbeitung} tone="o" label={m.panel.rework} />
    </span>
  );
}

function UnitRow({ m, unit, status }: Readonly<{ m: Messages; unit: UnitDef; status: UnitStatus | undefined }>) {
  const store = useCityStoreApi();
  const active = useCity((s) => s.selected === unit.id);
  return (
    <li>
      <button
        type="button"
        className={`tree-row level${unit.level}${unit.level === 0 ? ' root' : ''}${active ? ' active' : ''}`}
        title={m.units[unit.id].role}
        aria-pressed={active}
        data-unit={unit.id}
        onClick={() => store.getState().select(unit.id)}
      >
        <small aria-hidden="true">{unit.code}</small>
        {unit.name}
        <span className="sr-only">, {m.units[unit.id].role}</span>
        <Kpis m={m} status={status} />
      </button>
      {unit.subunits.map((sub) => {
        const dept = status?.departments.find((d) => d.abteilungId === sub.id);
        return (
          <div key={sub.id} className={`tree-sub level${unit.level}`}>
            <span aria-hidden="true">↳ </span>
            {abteilungName(sub.id)}
            {sub.external && ` · ${m.panel.external}`}
            {dept?.present ? ` · ${dept.tsOffen}/${dept.tsTotal} ${m.panel.open}` : ` · ${m.panel.noData}`}
          </div>
        );
      })}
    </li>
  );
}

/** Vista provisional de F1: la estructura de la ciudad con los datos del contrato. */
export function StructurePanel({ m, result, scenario }: Props) {
  const snapshot = result.ok ? result.snapshot : null;
  const statusOf = (unit: UnitDef) => snapshot?.units.find((s) => s.unitId === unit.id);
  const empty = snapshot !== null && snapshot.units.every((u) => !u.hasData);

  return (
    <>
      <div className="aside-top">
        {m.panel.top} <b>{String(CAMPUS_UNITS.length).padStart(2, '0')}</b>
      </div>
      {snapshot && (
        <div className="source-badge">
          {snapshot.source === 'mock' ? `${m.data.mock} · ${format(m.data.scenario, { name: scenario })}` : m.data.live}
          {snapshot.dataAsOf && ` · ${format(m.data.asOf, { time: timeInZurich(snapshot.dataAsOf, INTL_LOCALE) })}`}
        </div>
      )}
      {!result.ok && <p className="notice error" role="alert">{m.data.error}</p>}
      {empty && <p className="notice">{m.data.empty}</p>}
      {DISTRICT_IDS.map((district) => (
        <section key={district} className="tree-group" aria-labelledby={`district-${district}`}>
          <h2 id={`district-${district}`} className="section-label">{m.districts[district].toUpperCase()}</h2>
          <ul className="tree tree-list">
            {unitsByDistrict(CAMPUS_UNITS, district).map((unit) => (
              <UnitRow key={unit.id} m={m} unit={unit} status={statusOf(unit)} />
            ))}
          </ul>
        </section>
      ))}
      <FocusButton m={m} />
      <p className="note">{m.panel.note}</p>
    </>
  );
}

function FocusButton({ m }: Readonly<{ m: Messages }>) {
  const store = useCityStoreApi();
  return (
    <button type="button" className="focus-btn" onClick={() => store.getState().focus(store.getState().selected)}>
      <svg className="ico" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 28V12l11-5v21 M15 28V3l13 6v19 M2 28h28 M8 14v2 M8 20v2 M20 10v2 M24 12v2 M20 17v2 M24 19v2 M20 24v4" />
      </svg>
      {m.panel.focus}
    </button>
  );
}
