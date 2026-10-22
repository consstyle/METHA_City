'use client';

import { useMemo, useState } from 'react';
import type { Messages } from '@/i18n';
import { useHiring, useSim } from '@/os/OsProvider';
import { AgentCard } from './AgentCard';
import { ApprovalsCard } from './ApprovalsCard';
import { AGENT_FILTERS, filterAgents, type AgentFilter } from './directory';
import { SpecialistCatalog } from './SpecialistCatalog';

const FILTER_LABEL = { all: 'filterAll', units: 'filterUnits', specialists: 'filterSpecialists' } as const;

/** Módulo «Agenten»: quién trabaja en la ciudad, catálogo de especialistas y sus Freigaben. */
export function AgentDirectory({ m }: Readonly<{ m: Messages }>) {
  const sim = useSim();
  const hiring = useHiring((s) => s);
  const [filter, setFilter] = useState<AgentFilter>('all');
  const [announcement, setAnnouncement] = useState('');
  const agents = useMemo(() => (sim ? filterAgents(sim.agents, filter) : []), [sim, filter]);

  return (
    <main className="module-page" aria-labelledby="agents-page-title">
      <header className="module-head">
        <div className="eyebrow">{m.directory.eyebrow}</div>
        <h1 id="agents-page-title">{m.directory.titleLine1}<br />{m.directory.titleLine2}</h1>
        <p className="sim-note"><span className="sim-tag">{m.sim.badge}</span> {m.cockpit.simulation}</p>
      </header>
      <div className="segmented" role="group" aria-label={m.directory.filterLabel}>
        {AGENT_FILTERS.map((f) => (
          <button key={f} type="button" className="segment" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {m.directory[FILTER_LABEL[f]]}
          </button>
        ))}
      </div>
      {!sim && <p className="muted">{m.cockpit.starting}</p>}
      {sim && filter === 'specialists' && agents.length === 0 && <p className="empty-note">{m.directory.noSpecialists}</p>}
      <div className="agent-grid">
        {agents.map((a) => <AgentCard key={a.id} m={m} agent={a} />)}
      </div>
      {hiring && (
        <div className="module-grid">
          <SpecialistCatalog m={m} hiring={hiring} announce={setAnnouncement} />
          <ApprovalsCard m={m} hiring={hiring} announce={setAnnouncement} />
        </div>
      )}
      <p className="sr-only" role="status">{announcement}</p>
    </main>
  );
}
