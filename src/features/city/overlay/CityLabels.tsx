'use client';

import { useMemo } from 'react';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { format, type Messages } from '@/i18n';
import { useSim } from '@/os/OsProvider';
import type { LabelRegistry } from './labelRegistry';
import { labelTargets, type LabelTarget } from './labelTargets';

function kicker(t: LabelTarget, m: Messages): string {
  if (t.kicker.kind === 'site') return format(m.labels.site, { nr: t.kicker.nr });
  return t.kicker.kind === 'orchestrator' ? m.labels.orchestrator : m.labels.industrial;
}

/**
 * Etiquetas de los edificios y de las obras con líneas guía (preview.html). La escena las coloca
 * en cada fotograma (LabelProjector); aquí solo se crean, se rellenan y se seleccionan.
 */
export function CityLabels({ m, registry }: Readonly<{ m: Messages; registry: LabelRegistry }>) {
  const store = useCityStoreApi();
  const selected = useCity((s) => s.selected);
  const visible = useCity((s) => s.options.tags && s.view === 'city');
  const sites = useCity((s) => s.sites);
  const targets = useMemo(() => labelTargets(sites), [sites]);
  const sim = useSim();

  return (
    <div className="labels-layer" style={{ display: visible ? undefined : 'none' }}>
      <svg className="leaders" aria-hidden="true">
        {targets.map((t) => (
          <path
            key={t.id}
            ref={(el) => {
              if (el) registry.paths.set(t.id, el);
              else registry.paths.delete(t.id);
            }}
            style={{ display: 'none' }}
          />
        ))}
      </svg>
      {targets.map((t) => {
        const state = sim?.agents.find((a) => a.id === t.agentId)?.state ?? 'offline';
        return (
          <button
            key={t.id}
            type="button"
            ref={(el) => {
              if (el) registry.labels.set(t.id, el);
              else registry.labels.delete(t.id);
            }}
            className={`label${t.kicker.kind === 'site' ? ' site' : ''}${selected === t.id ? ' active' : ''}`}
            data-label={t.id}
            aria-pressed={selected === t.id}
            aria-label={`${format(m.labels.select, { name: t.name })} · ${m.agentState[state]}`}
            style={{ display: 'none' }}
            onClick={() => store.getState().select(t.id)}
          >
            <small>{kicker(t, m)}</small>
            <span className="label-name">
              <i className={`ldot ${state}`} aria-hidden="true" />
              {t.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
