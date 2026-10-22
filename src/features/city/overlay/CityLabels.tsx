'use client';

import { CAMPUS_UNITS } from '@/features/city/model/campus';
import type { UnitDef } from '@/features/city/model/types';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { format, type Messages } from '@/i18n';
import { useSim } from '@/os/OsProvider';
import type { LabelRegistry } from './labelRegistry';

function kicker(u: UnitDef, m: Messages): string {
  if (u.parent === null && u.archetype === 'tower') return m.labels.orchestrator;
  return u.district === 'project' ? format(m.labels.projectLevel, { n: u.level + 1 }) : m.labels.industrial;
}

/**
 * Etiquetas de los edificios con líneas guía (preview.html). La escena las coloca en cada
 * fotograma (LabelProjector); aquí solo se crean, se rellenan y se seleccionan.
 */
export function CityLabels({ m, registry }: Readonly<{ m: Messages; registry: LabelRegistry }>) {
  const store = useCityStoreApi();
  const selected = useCity((s) => s.selected);
  const visible = useCity((s) => s.options.tags && s.view === 'city');
  const sim = useSim();

  return (
    <div className="labels-layer" style={{ display: visible ? undefined : 'none' }}>
      <svg className="leaders" aria-hidden="true">
        {CAMPUS_UNITS.map((u) => (
          <path
            key={u.id}
            ref={(el) => {
              if (el) registry.paths.set(u.id, el);
              else registry.paths.delete(u.id);
            }}
            style={{ display: 'none' }}
          />
        ))}
      </svg>
      {CAMPUS_UNITS.map((u) => {
        const state = sim?.agents.find((a) => a.id === (u.agent ?? u.id))?.state ?? 'offline';
        return (
          <button
            key={u.id}
            type="button"
            ref={(el) => {
              if (el) registry.labels.set(u.id, el);
              else registry.labels.delete(u.id);
            }}
            className={`label${selected === u.id ? ' active' : ''}`}
            data-label={u.id}
            aria-pressed={selected === u.id}
            aria-label={`${format(m.labels.select, { name: u.name })} · ${m.agentState[state]}`}
            style={{ display: 'none' }}
            onClick={() => store.getState().select(u.id)}
          >
            <small>{kicker(u, m)}</small>
            <span className="label-name">
              <i className={`ldot ${state}`} aria-hidden="true" />
              {u.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
