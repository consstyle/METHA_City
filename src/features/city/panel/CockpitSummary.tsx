'use client';

import Link from 'next/link';
import { useScenarioQuery } from '@/components/useScenarioQuery';
import { format, type Messages } from '@/i18n';
import { useSim } from '@/os/OsProvider';
import { useCounts } from '@/os/useCounts';

/** Resumen del Leitstand en la cabecera del panel de la ciudad (decisión D9). */
export function CockpitSummary({ m }: Readonly<{ m: Messages }>) {
  const sim = useSim();
  const query = useScenarioQuery();
  const working = sim?.agents.filter((a) => a.state === 'working').length ?? 0;
  const counts = useCounts();
  return (
    <div className="cockpit-summary">
      <div className="summary-head">
        <span>{m.panel.summaryTitle}</span>
        <span className="sim-tag">{m.sim.badge}</span>
      </div>
      {sim ? (
        <p>
          <span className="state-dot working" aria-hidden="true" /> {format(m.panel.agentsWorking, { n: working, total: sim.agents.length })}
          <br />
          <span className="state-dot waiting" aria-hidden="true" /> {format(m.panel.approvalsPending, { n: counts?.approvals ?? 0 })}
        </p>
      ) : (
        <p className="muted">{m.cockpit.starting}</p>
      )}
      <Link href={`/leitstand${query}`} className="summary-link">{m.panel.openCockpit} <span aria-hidden="true">→</span></Link>
    </div>
  );
}
