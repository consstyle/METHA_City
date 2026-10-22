'use client';

import { abteilungName } from '@/features/city/model/abteilungen';
import type { SnapshotResult } from '@/data/load';
import type { MockScenario } from '@/data/mock/scenarios';
import type { UnitStatus } from '@/data/contract';
import { format, INTL_LOCALE, type Messages } from '@/i18n';
import { formatDateCh, timeInZurich } from '@/lib/dates';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
  readonly status: UnitStatus | undefined;
}

/** Indicadores de MethaDesk de la unidad (solo lectura). Sin datos → mensaje, nunca ceros falsos. */
export function MethadeskSection({ m, result, scenario, status }: Props) {
  const snapshot = result.ok ? result.snapshot : null;
  return (
    <section className="panel-section" aria-labelledby="methadesk-title">
      <h3 id="methadesk-title" className="section-label">{m.panel.methadeskTitle}</h3>
      {snapshot && (
        <div className="source-badge">
          {snapshot.source === 'mock' ? `${m.data.mock} · ${format(m.data.scenario, { name: scenario })}` : m.data.live}
          {snapshot.dataAsOf && ` · ${format(m.data.asOf, { time: timeInZurich(snapshot.dataAsOf, INTL_LOCALE) })}`}
        </div>
      )}
      {!result.ok && <p className="notice error" role="alert">{m.data.error}</p>}
      {result.ok && !status?.hasData && <p className="notice">{m.data.empty}</p>}
      {status?.hasData && (
        <>
          <dl className="facts">
            <div><dt>{m.panel.open}</dt><dd>{status.ts.offen} / {status.ts.total}</dd></div>
            <div><dt>{m.panel.overdue}</dt><dd className={status.alerts.montageUeberfaellig > 0 ? 'warn' : undefined}>{status.alerts.montageUeberfaellig}</dd></div>
            <div><dt>{m.panel.rework}</dt><dd className={status.alerts.nachbearbeitung > 0 ? 'hot' : undefined}>{status.alerts.nachbearbeitung}</dd></div>
            <div>
              <dt>{m.panel.nextMontage}</dt>
              <dd>{status.naechsterMontagetermin ? formatDateCh(status.naechsterMontagetermin) : m.agents.never}</dd>
            </div>
          </dl>
          {status.departments.length > 1 && (
            <div className="subunits">
              <div className="subunits-title">{m.panel.subunits}</div>
              {status.departments.slice(1).map((d) => (
                <div key={d.abteilungId} className="subunit-row">
                  <span>{abteilungName(d.abteilungId)}</span>
                  <span>{d.present ? `${d.tsOffen}/${d.tsTotal} ${m.panel.open}` : m.panel.noData}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
