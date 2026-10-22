'use client';

import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { KIND_COLORS } from '@/features/city/flow/tsFlow';
import { useCity, useFlow } from '@/features/city/state/CityStoreProvider';
import { format, type Messages } from '@/i18n';

const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** «TS in Bewegung» (preview.html): los últimos Teilsysteme que han salido por las calles. */
export function FlowFeed({ m }: Readonly<{ m: Messages }>) {
  const feed = useFlow((s) => s.feed);
  const on = useCity((s) => s.options.flow);
  const sites = useCity((s) => s.sites);
  // Edificio del campus o obra («Baustelle DEV-001»).
  const nameOf = (id: string) => {
    const site = sites.find((s) => s.id === id);
    if (site) return format(m.flow.site, { nr: site.projektnummer });
    return CAMPUS_UNITS.find((u) => u.id === id)?.name ?? id;
  };
  return (
    <section className="panel-section" aria-labelledby="flow-title">
      <h3 id="flow-title" className="section-label">
        {m.flow.feedTitle} <span className="sim-tag">{m.sim.badge}</span>
      </h3>
      {/* Apagado: se avisa también si queda una lista anterior (no está «en vivo»). */}
      {!on && <p className="feed-empty">{m.flow.off}</p>}
      {on && feed.length === 0 && <p className="feed-empty">{m.flow.waiting}</p>}
      {feed.length > 0 && (
        <ul className={`ts-feed${on ? '' : ' paused'}`}>
          {feed.map((e) => (
            <li key={e.seq} className="ts-row" data-ts={e.kind}>
              <i style={{ background: css(KIND_COLORS[e.kind]) }} aria-hidden="true" />
              <b>{format(m.flow.tag, { nr: e.nr })}</b>
              <span>{format(m.flow.route, { from: nameOf(e.from), to: nameOf(e.to) })}</span>
              <em>{m.flow.kinds[e.kind]}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
