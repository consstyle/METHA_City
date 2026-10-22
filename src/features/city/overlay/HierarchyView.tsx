'use client';

import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { childrenOf, unitById } from '@/features/city/model/hierarchy';
import type { UnitDef } from '@/features/city/model/types';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';

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

/** Vista «Hierarchie» de preview.html: los dos distritos y el enlace transversal. */
export function HierarchyView({ m }: Readonly<{ m: Messages }>) {
  const avor = unitById(CAMPUS_UNITS, 'avor');
  const chain = CAMPUS_UNITS.filter((u) => u.district === 'project').sort((a, b) => a.level - b.level);
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
          <div className="org-chain">
            {chain.map((u) => <Node key={u.id} m={m} unit={u} withRole />)}
          </div>
        </section>
      </div>
      <div className="org-bridge">
        <small>{m.hierarchy.bridge}</small>
        {avor.name} &nbsp; ↔ &nbsp; {unitById(CAMPUS_UNITS, 'bauleitung')?.name}
      </div>
    </div>
  );
}
