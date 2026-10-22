'use client';

import type { Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { activityText } from '@/os/format';
import type { SimState } from '@/os/simulation/engine';

const FEED_SIZE = 12;

/** Últimos eventos de los agentes, el más reciente arriba. */
export function ActivityFeed({ m, sim }: Readonly<{ m: Messages; sim: SimState | null }>) {
  const events = sim ? [...sim.activity].reverse().slice(0, FEED_SIZE) : [];
  return (
    <section className="card activity-card" aria-labelledby="activity-title">
      <h2 id="activity-title" className="card-title">{m.cockpit.activityTitle}</h2>
      {!sim && <p className="muted">{m.cockpit.starting}</p>}
      {sim && events.length === 0 && <p className="muted">{m.cockpit.noActivity}</p>}
      {/* Sin aria-live: se actualiza cada pocos segundos y saturaría el lector de pantalla. */}
      <ol className="feed">
        {events.map((e) => (
          <li key={e.id} className={`feed-item ${e.type}`}>
            <span className="feed-dot" aria-hidden="true" />
            <span className="feed-text">{activityText(e, m)}</span>
            <time className="feed-time" dateTime={e.at}>{sim ? relativeTimeDe(e.at, new Date(sim.now)) : ''}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
