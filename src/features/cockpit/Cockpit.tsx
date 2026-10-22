'use client';

import type { SnapshotResult } from '@/data/load';
import type { Messages } from '@/i18n';
import { useSim } from '@/os/OsProvider';
import { SIMULATED_HEALTH } from '@/os/simulation/engine';
import { ActivityFeed } from './ActivityFeed';
import { AgentsTable } from './AgentsTable';
import { HealthCard } from './HealthCard';
import { MethadeskCard } from './MethadeskCard';

function Stat({ value, label, tone }: Readonly<{ value: string | number; label: string; tone?: 'hot' | 'warn' }>) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/** Módulo «Leitstand» (Cockpit de NEXORA) con el lenguaje visual de preview.html. */
export function Cockpit({ m, result }: Readonly<{ m: Messages; result: SnapshotResult }>) {
  const sim = useSim();
  const units = result.ok ? result.snapshot.units.filter((u) => u.hasData) : [];
  const alerts = units.reduce((s, u) => s + u.alerts.montageUeberfaellig + u.alerts.nachbearbeitung, 0);
  const working = sim?.agents.filter((a) => a.state === 'working').length;
  const dash = '—';

  return (
    <main className="cockpit" aria-labelledby="cockpit-title">
      <header className="cockpit-head">
        <div className="eyebrow">{m.cockpit.eyebrow}</div>
        <h1 id="cockpit-title">{m.cockpit.titleLine1}<br />{m.cockpit.titleLine2}</h1>
        <p className="sim-note"><span className="sim-tag">{m.sim.badge}</span> {m.cockpit.simulation}</p>
      </header>
      <section className="stat-grid" aria-label={m.cockpit.eyebrow}>
        <Stat value={sim ? `${working} / ${sim.agents.length}` : dash} label={m.cockpit.agentsActive} tone="hot" />
        <Stat value={sim?.tasksOpen ?? dash} label={m.cockpit.tasksOpen} />
        <Stat value={sim?.approvalsPending ?? dash} label={m.cockpit.approvals} tone={sim && sim.approvalsPending > 0 ? 'warn' : undefined} />
        <Stat value={sim?.missionsRunning ?? dash} label={m.cockpit.missions} />
        <Stat value={result.ok ? alerts : dash} label={m.cockpit.alerts} tone={alerts > 0 ? 'warn' : undefined} />
      </section>
      <div className="cockpit-grid">
        <AgentsTable m={m} sim={sim} />
        <ActivityFeed m={m} sim={sim} />
        <HealthCard m={m} health={SIMULATED_HEALTH} />
        <MethadeskCard m={m} result={result} />
      </div>
    </main>
  );
}
