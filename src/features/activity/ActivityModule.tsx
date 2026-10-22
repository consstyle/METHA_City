'use client';

import { useMemo, useState } from 'react';
import { filterAgents } from '@/features/agents/directory';
import { format, type Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { agentName } from '@/os/format';
import { useJournal, useSim } from '@/os/OsProvider';
import { buildFeed, FEED_KINDS, filterFeed, type FeedKind } from './feed';

const SHOWN = 100;

/** Módulo «Aktivität» (D21): todo lo que pasa, filtrable, y la vista de comunicación entre agentes. */
export function ActivityModule({ m }: Readonly<{ m: Messages }>) {
  const sim = useSim();
  const journal = useJournal((s) => s.entries);
  const [comms, setComms] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [kinds, setKinds] = useState<ReadonlySet<FeedKind>>(new Set(FEED_KINDS));
  const [query, setQuery] = useState('');
  const feed = useMemo(() => (sim && journal ? buildFeed(sim.activity, journal, m) : null), [sim, journal, m]);
  const matching = useMemo(
    () => (feed ? filterFeed(feed, { agentId: agentId || null, kinds, query, comms }) : []),
    [feed, agentId, kinds, query, comms],
  );
  const shown = matching.slice(0, SHOWN);
  const agents = useMemo(() => (sim ? filterAgents(sim.agents, 'all') : []), [sim]);
  const toggle = (k: FeedKind) => setKinds((prev) => (prev.has(k) ? new Set([...prev].filter((x) => x !== k)) : new Set([...prev, k])));

  return (
    <main className="module-page" aria-labelledby="activity-page-title">
      <header className="module-head">
        <div className="eyebrow">{m.activityLog.eyebrow}</div>
        <h1 id="activity-page-title">{m.activityLog.titleLine1}<br />{m.activityLog.titleLine2}</h1>
      </header>
      <div className="segmented" role="group" aria-label={m.activityLog.tabsLabel}>
        <button type="button" className="segment" aria-pressed={!comms} onClick={() => setComms(false)}>{m.activityLog.tabAll}</button>
        <button type="button" className="segment" aria-pressed={comms} onClick={() => setComms(true)}>{m.activityLog.tabComms}</button>
      </div>
      <div className="card filters">
        <div>
          <label className="field-label" htmlFor="activity-agent">{m.activityLog.agentFilter}</label>
          <select id="activity-agent" className="text-input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">{m.activityLog.allAgents}</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{agentName(a.id, m)}</option>)}
          </select>
        </div>
        <fieldset className="chip-row" disabled={comms}>
          <legend className="field-label">{m.activityLog.typeFilter}</legend>
          {FEED_KINDS.map((k) => (
            <label key={k} className={`radio-pill${kinds.has(k) ? ' checked' : ''}`}>
              <input type="checkbox" checked={kinds.has(k)} onChange={() => toggle(k)} />
              {m.activityLog.types[k]}
            </label>
          ))}
        </fieldset>
        <div className="grow">
          <label className="field-label" htmlFor="activity-search">{m.activityLog.search}</label>
          <input id="activity-search" type="search" className="text-input" value={query} placeholder={m.activityLog.searchPlaceholder} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <section className="card" aria-labelledby="activity-list-title">
        <h2 id="activity-list-title" className="card-title">{format(m.activityLog.count, { shown: shown.length, n: matching.length })}</h2>
        {!feed && <p className="muted">{m.cockpit.starting}</p>}
        {feed && shown.length === 0 && <p className="empty-note">{m.activityLog.empty}</p>}
        <ol className="feed">
          {shown.map((item) => (
            <li key={item.id} className={`feed-item kind-${item.kind}`} data-feed={item.kind}>
              <span className="feed-dot" aria-hidden="true" />
              <span className="feed-text">
                <span className={`source-tag ${item.source}`}>{item.source === 'live' ? m.activityLog.live : m.activityLog.journal}</span> {item.text}
              </span>
              <time className="feed-time" dateTime={item.at}>{sim ? relativeTimeDe(item.at, new Date(sim.now)) : ''}</time>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
