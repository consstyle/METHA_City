'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { format, type Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { collectApprovals, type ApprovalItem, type ApprovalSource } from '@/os/approvals';
import { useHiring, useMissions, useSim } from '@/os/OsProvider';

const SOURCES: readonly ApprovalSource[] = ['plan', 'result', 'hire', 'retire'];

/** Módulo «Freigaben» (D19): planes, resultados, contrataciones y retiradas, con su historial. */
export function ApprovalsModule({ m }: Readonly<{ m: Messages }>) {
  const hiring = useHiring((s) => s);
  const missions = useMissions((s) => s);
  const sim = useSim();
  const [filter, setFilter] = useState<ApprovalSource | 'all'>('all');
  const [announcement, setAnnouncement] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const items = useMemo(
    () => (hiring && missions ? collectApprovals(hiring.hiring, missions.missions, m) : null),
    [hiring, missions, m],
  );
  const now = new Date(sim?.now ?? 0);
  const ago = (iso: string) => (sim ? relativeTimeDe(iso, now) : '');

  const decide = (item: ApprovalItem, approve: boolean) => {
    const ok = item.missionId && (item.source === 'plan' || item.source === 'result')
      ? missions?.decide(item.missionId, item.source, approve)
      : hiring?.decide(item.id, approve);
    if (!ok) return;
    setAnnouncement(format(m.approvals.announced, { status: m.approvals.status[approve ? 'approved' : 'rejected'], title: item.title }));
    heading.current?.focus();
  };
  const history = items?.history.filter((h) => filter === 'all' || h.source === filter) ?? [];

  return (
    <main className="module-page" aria-labelledby="approvals-page-title">
      <header className="module-head">
        <div className="eyebrow">{m.approvals.eyebrow}</div>
        <h1 id="approvals-page-title">{m.approvals.titleLine1}<br />{m.approvals.titleLine2}</h1>
        <p className="sim-note"><span className="sim-tag">{m.sim.badge}</span> {m.cockpit.simulation}</p>
      </header>
      <div className="module-grid">
        <section className="card" aria-labelledby="pending-title">
          <h2 id="pending-title" ref={heading} tabIndex={-1} className="card-title">
            {m.approvals.pendingTitle} {items && items.pending.length > 0 && <span className="count-badge">{items.pending.length}</span>}
          </h2>
          {!items && <p className="muted">{m.cockpit.starting}</p>}
          {items?.pending.length === 0 && <p className="empty-note">{m.approvals.noPending}</p>}
          <ul className="approval-list">
            {items?.pending.map((item) => (
              <li key={item.id} className="approval-item" data-approval-item={item.source}>
                <span className="kind-tag">{m.approvals.kinds[item.source]}</span>
                <strong>{item.title}</strong>
                <span className="muted">{item.detail} · {format(m.approvals.requested, { when: ago(item.requestedAt) })}</span>
                <span className="approval-actions">
                  <button type="button" className="ghost-btn small primary" aria-label={`${m.approvals.approve}: ${item.title}`} onClick={() => decide(item, true)}>{m.approvals.approve}</button>
                  {item.canReject ? (
                    <button type="button" className="ghost-btn small" aria-label={`${m.approvals.reject}: ${item.title}`} onClick={() => decide(item, false)}>{m.approvals.reject}</button>
                  ) : (
                    <span className="muted">{m.missions.noMoreRevisions}</span>
                  )}
                  {item.missionId && <Link className="ghost-btn small" href={`/missionen/${item.missionId}`}>{m.approvals.openMission}</Link>}
                </span>
              </li>
            ))}
          </ul>
          <p className="sr-only" role="status">{announcement}</p>
        </section>
        <section className="card" aria-labelledby="history-title">
          <h2 id="history-title" className="card-title">{m.approvals.historyTitle}</h2>
          <div className="segmented compact" role="group" aria-label={m.approvals.filterLabel}>
            {(['all', ...SOURCES] as const).map((s) => (
              <button key={s} type="button" className="segment" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                {s === 'all' ? m.approvals.filterAll : m.approvals.kinds[s]}
              </button>
            ))}
          </div>
          {items && history.length === 0 && <p className="empty-note">{m.approvals.noHistory}</p>}
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id} className={`history-item ${item.status}`} data-history={item.status}>
                <span className="kind-tag">{m.approvals.kinds[item.source]}</span>
                <span className="history-title">{item.title}</span>
                <span className={`decision ${item.status}`}>
                  {format(m.approvals.decided, { status: m.approvals.status[item.status], when: item.decidedAt ? ago(item.decidedAt) : '' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
