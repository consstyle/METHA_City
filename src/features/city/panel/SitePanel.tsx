'use client';

import type { SnapshotResult } from '@/data/load';
import type { MockScenario } from '@/data/mock/scenarios';
import type { ProjectSite } from '@/features/city/model/projects';
import { format, INTL_LOCALE, type Messages } from '@/i18n';
import { formatDateCh, timeInZurich } from '@/lib/dates';
import { AgentSection } from './AgentSection';

export const SITE_ICON = (
  <svg className="ico" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M3 28h26 M6 28V16h12v12 M6 22h12 M24 28V4 M24 4H10 M24 4l5 4 M14 4v5 M12 9h4v3h-4z" />
  </svg>
);

interface Props {
  readonly m: Messages;
  readonly site: ProjectSite;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
}

/** Números del proyecto en mc.projekt_kennzahlen (solo lectura). Sin datos → aviso, nunca ceros falsos. */
function ProjectFacts({ m, site, result, scenario }: Props) {
  const snapshot = result.ok ? result.snapshot : null;
  const p = snapshot?.projects.find((x) => x.projektId === site.projektId);
  return (
    <section className="panel-section" aria-labelledby="site-methadesk-title">
      <h3 id="site-methadesk-title" className="section-label">{m.panel.methadeskTitle}</h3>
      {snapshot && (
        <div className="source-badge">
          {snapshot.source === 'mock' ? `${m.data.mock} · ${format(m.data.scenario, { name: scenario })}` : m.data.live}
          {snapshot.dataAsOf && ` · ${format(m.data.asOf, { time: timeInZurich(snapshot.dataAsOf, INTL_LOCALE) })}`}
        </div>
      )}
      {!result.ok && <p className="notice error" role="alert">{m.data.error}</p>}
      {result.ok && !p && <p className="notice">{m.site.noData}</p>}
      {p && (
        <dl className="facts">
          <div><dt>{m.site.verbaut}</dt><dd>{p.tsVerbaut} / {p.tsTotal}</dd></div>
          <div><dt>{m.panel.overdue}</dt><dd className={p.montageUeberfaellig > 0 ? 'warn' : undefined}>{p.montageUeberfaellig}</dd></div>
          <div><dt>{m.panel.rework}</dt><dd className={p.nachbearbeitung > 0 ? 'hot' : undefined}>{p.nachbearbeitung}</dd></div>
          <div><dt>{m.site.express}</dt><dd>{p.express}</dd></div>
          <div><dt>{m.site.abruf}</dt><dd>{p.abrufAktiv}</dd></div>
          <div>
            <dt>{m.panel.nextMontage}</dt>
            <dd>{p.naechsterMontagetermin ? formatDateCh(p.naechsterMontagetermin) : m.agents.never}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

/** Ficha de una obra de proyecto (F5c): el proyecto, su equipo (PL y BL) y sus números de MethaDesk. */
export function SiteDetails({ m, site, result, scenario }: Props) {
  return (
    <>
      <div className="panel-hero">
        <div className="building-symbol">{SITE_ICON}</div>
        <div>
          <h2>{site.projektname}</h2>
          <small>{format(m.labels.site, { nr: site.projektnummer })}</small>
        </div>
      </div>
      <span className="role">{m.site.role}</span>
      <p className="description">{format(m.site.description, { nr: site.projektnummer })}</p>
      <AgentSection m={m} agentId={site.agents.pl} title={m.site.plTitle} />
      <AgentSection m={m} agentId={site.agents.bl} title={m.site.blTitle} />
      <ProjectFacts m={m} site={site} result={result} scenario={scenario} />
    </>
  );
}
