'use client';

import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { childrenOf, unitById } from '@/features/city/model/hierarchy';
import type { ProjectSite } from '@/features/city/model/projects';
import type { UnitDef } from '@/features/city/model/types';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { format, type Messages } from '@/i18n';

function Node({ m, unit, primary = false, withRole = false }: Readonly<{ m: Messages; unit: UnitDef; primary?: boolean; withRole?: boolean }>) {
  const store = useCityStoreApi();
  const active = useCity((s) => s.selected === unit.id);
  return (
    <button
      type="button"
      className={`org-node${primary ? ' primary' : ''}${active ? ' active' : ''}`}
      aria-pressed={active}
      data-org={unit.id}
      onClick={() => store.getState().select(unit.id)}
    >
      {withRole && <span>{m.units[unit.id].role}</span>}
      {unit.name}
    </button>
  );
}

/** Una obra con su equipo: Projektleitung → Bauleitung (F5c). */
function SiteNode({ m, site }: Readonly<{ m: Messages; site: ProjectSite }>) {
  const store = useCityStoreApi();
  const active = useCity((s) => s.selected === site.id);
  return (
    <button
      type="button"
      className={`org-node${active ? ' active' : ''}`}
      aria-pressed={active}
      data-org={site.id}
      onClick={() => store.getState().select(site.id)}
    >
      <span>{format(m.labels.site, { nr: site.projektnummer })}</span>
      {site.projektname}
      <span>{m.hierarchy.team}</span>
    </button>
  );
}

/** Vista «Hierarchie» de preview.html: el campus, las obras de los proyectos y su coordinación. */
export function HierarchyView({ m }: Readonly<{ m: Messages }>) {
  const avor = unitById(CAMPUS_UNITS, 'avor');
  const sites = useCity((s) => s.sites);
  if (!avor) return null;
  return (
    <div className="hierarchy-view">
      <div className="scene-title">
        <div className="eyebrow">{m.hierarchy.eyebrow}</div>
        <h1>{m.hierarchy.titleLine1}<br />{m.hierarchy.titleLine2}</h1>
      </div>
      <div className="org-intro">{m.hierarchy.intro}</div>
      <div className="org-grid">
        <section className="org-district" aria-label={m.districts.industrial}>
          <small>{m.hierarchy.industrial}</small>
          <Node m={m} unit={avor} primary withRole />
          <div className="org-children">
            {childrenOf(CAMPUS_UNITS, 'avor').map((u) => <Node key={u.id} m={m} unit={u} />)}
          </div>
        </section>
        <section className="org-district" aria-label={m.districts.project}>
          <small>{m.hierarchy.project}</small>
          <div className="org-sites">
            {sites.length === 0 && <p className="muted">{m.hierarchy.noSites}</p>}
            {sites.map((s) => <SiteNode key={s.id} m={m} site={s} />)}
          </div>
        </section>
      </div>
      <div className="org-bridge">
        <small>{m.hierarchy.bridge}</small>
        {avor.name} &nbsp; ↔ &nbsp; {m.hierarchy.bridgeTarget}
      </div>
    </div>
  );
}
