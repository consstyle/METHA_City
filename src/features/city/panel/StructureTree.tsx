'use client';

import { abteilungName } from '@/features/city/model/abteilungen';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitsByDistrict } from '@/features/city/model/hierarchy';
import type { ProjectSite } from '@/features/city/model/projects';
import { DISTRICT_IDS, type UnitDef } from '@/features/city/model/types';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { ProjectStatus, UnitStatus } from '@/data/contract';
import { format, type Messages } from '@/i18n';

function Badge({ n, tone, label }: Readonly<{ n: number; tone: 'r' | 'o'; label: string }>) {
  if (n <= 0) return null;
  return (
    <span className={`badge ${tone}`} title={label}>
      {n}
      <span className="sr-only"> {label}</span>
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
        <span className="kpis">
          {status?.hasData ? (
            <>
              <Badge n={status.alerts.montageUeberfaellig} tone="r" label={m.panel.overdue} />
              <Badge n={status.alerts.nachbearbeitung} tone="o" label={m.panel.rework} />
            </>
          ) : (
            <span className="no-data">{m.panel.noData}</span>
          )}
          <span className="arr" aria-hidden="true">{active ? '↗' : ''}</span>
        </span>
      </button>
      {unit.subunits.map((sub) => (
        <div key={sub.id} className={`tree-sub level${unit.level}`}>
          <span aria-hidden="true">↳ </span>
          {abteilungName(sub.id)}
          {sub.external && ` · ${m.panel.external}`}
        </div>
      ))}
    </li>
  );
}

/** Una obra de proyecto en el árbol (distrito «Baustellen»), con sus alarmas de MethaDesk. */
function SiteRow({ m, site, status }: Readonly<{ m: Messages; site: ProjectSite; status: ProjectStatus | undefined }>) {
  const store = useCityStoreApi();
  const active = useCity((s) => s.selected === site.id);
  return (
    <li>
      <button
        type="button"
        className={`tree-row level1${active ? ' active' : ''}`}
        title={format(m.labels.site, { nr: site.projektnummer })}
        aria-pressed={active}
        data-site={site.id}
        onClick={() => store.getState().select(site.id)}
      >
        <small aria-hidden="true">{site.projektnummer}</small>
        {site.projektname}
        <span className="kpis">
          {status ? (
            <>
              <Badge n={status.montageUeberfaellig} tone="r" label={m.panel.overdue} />
              <Badge n={status.nachbearbeitung} tone="o" label={m.panel.rework} />
            </>
          ) : (
            <span className="no-data">{m.panel.noData}</span>
          )}
          <span className="arr" aria-hidden="true">{active ? '↗' : ''}</span>
        </span>
      </button>
    </li>
  );
}

interface TreeProps {
  readonly m: Messages;
  readonly statuses: readonly UnitStatus[];
  readonly projects: readonly ProjectStatus[];
}

/** Árbol del campus y de las obras (panel de preview.html), seleccionable con ratón y teclado. */
export function StructureTree({ m, statuses, projects }: TreeProps) {
  const sites = useCity((s) => s.sites);
  return (
    <div className="tree">
      {DISTRICT_IDS.map((district) => (
        <section key={district} className="tree-group" aria-labelledby={`district-${district}`}>
          <h3 id={`district-${district}`} className="tree-district">{m.districts[district].toUpperCase()}</h3>
          <ul className="tree-list">
            {district === 'project' && sites.length === 0 && <li className="no-data">{m.hierarchy.noSites}</li>}
            {district === 'project'
              ? sites.map((site) => (
                <SiteRow key={site.id} m={m} site={site} status={projects.find((p) => p.projektId === site.projektId)} />
              ))
              : unitsByDistrict(CAMPUS_UNITS, district).map((unit) => (
                <UnitRow key={unit.id} m={m} unit={unit} status={statuses.find((s) => s.unitId === unit.id)} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
