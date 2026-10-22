'use client';

import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';

/** Barra inferior de preview.html: órbita, conexiones, nombres, flujo de TS y luz. */
export function Toolbar({ m }: Readonly<{ m: Messages }>) {
  const store = useCityStoreApi();
  const { auto, links, tags, flow, day } = useCity((s) => s.options);
  const toggle = store.getState().toggle;
  return (
    <div className="toolbar" role="group" aria-label={m.toolbar.label}>
      <button type="button" className="tool" aria-pressed={auto} onClick={() => toggle('auto')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8 M4 4v6h6" /></svg>
        {m.toolbar.orbit}
      </button>
      <div className="sep" />
      <button type="button" className="tool" aria-pressed={links} onClick={() => toggle('links')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="3" /><circle cx="19" cy="5" r="3" /><circle cx="19" cy="19" r="3" /><path d="m8 11 8-5 M8 13l8 5" />
        </svg>
        {m.toolbar.links}
      </button>
      <button type="button" className="tool" aria-pressed={tags} onClick={() => toggle('tags')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H9l-5 4Z" /></svg>
        {m.toolbar.names}
      </button>
      <button type="button" className="tool" aria-pressed={flow} title={m.toolbar.flowTitle} onClick={() => toggle('flow')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="8" width="12" height="8" rx="1" /><path d="M14 11h4l3 3v2h-7" /><circle cx="6" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" />
        </svg>
        {m.toolbar.flow}
      </button>
      <div className="sep" />
      <button type="button" className="tool" aria-pressed={day} onClick={() => toggle('day')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2" />
        </svg>
        {day ? m.toolbar.daylight : m.toolbar.sunset}
      </button>
    </div>
  );
}
