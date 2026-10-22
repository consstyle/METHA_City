'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { format, INTL_LOCALE, type Messages } from '@/i18n';
import { formatDateCh, timeInZurich, todayInZurich } from '@/lib/dates';
import type { Mission } from '@/os/missions/contract';
import { canRevise, isFinished } from '@/os/missions/mission';
import { agentName } from '@/os/format';
import { useMissions } from '@/os/OsProvider';
import { reportFileName } from './missionView';
import { MissionProgress, MissionStatusChip } from './MissionStatus';
import { ReportView } from './ReportView';

const when = (iso: string) => `${formatDateCh(todayInZurich(new Date(iso)))} ${timeInZurich(iso, INTL_LOCALE)}`;

function download(mission: Mission) {
  if (!mission.report) return;
  const url = URL.createObjectURL(new Blob([mission.report], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = reportFileName(mission.objective);
  document.body.append(a);
  a.click();
  a.remove();
  // Se libera después: revocar en el mismo instante puede cortar la descarga en algunos navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Decisiones pendientes de la misión (las mismas que en el módulo Freigaben). */
function Actions({ m, mission, onDone }: Readonly<{ m: Messages; mission: Mission; onDone: (text: string) => void }>) {
  const missions = useMissions((s) => s);
  if (!missions) return null;
  const j = m.journal;
  const vars = { objective: mission.objective };
  // Se anuncia el resultado («Plan genehmigt»), no el texto del botón.
  const act = (kind: 'plan' | 'result', approve: boolean, outcome: string) => {
    if (missions.decide(mission.id, kind, approve)) onDone(format(outcome, vars));
  };
  return (
    <div className="row-actions">
      {mission.status === 'awaiting-plan' && (
        <>
          <button type="button" className="ghost-btn small primary" onClick={() => act('plan', true, j.planApproved)}>{m.missions.approvePlan}</button>
          <button type="button" className="ghost-btn small" onClick={() => act('plan', false, j.planRejected)}>{m.missions.rejectPlan}</button>
        </>
      )}
      {mission.status === 'awaiting-result' && (
        <>
          <button type="button" className="ghost-btn small primary" onClick={() => act('result', true, j.resultApproved)}>{m.missions.approveResult}</button>
          {canRevise(mission) ? (
            <button type="button" className="ghost-btn small" onClick={() => act('result', false, j.resultRejected)}>{m.missions.rejectResult}</button>
          ) : (
            <span className="muted">{m.missions.noMoreRevisions}</span>
          )}
        </>
      )}
      {!isFinished(mission) && (
        <button type="button" className="ghost-btn small danger" onClick={() => { if (missions.cancel(mission.id)) onDone(format(j.missionCancelled, vars)); }}>
          {m.missions.cancel}
        </button>
      )}
    </div>
  );
}

/** Detalle de una misión: plan con el estado de cada paso, decisiones e informe (F5). */
export function MissionDetail({ m, missionId }: Readonly<{ m: Messages; missionId: string }>) {
  const missions = useMissions((s) => s.missions);
  const heading = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const mission = missions?.find((x) => x.id === missionId);
  const back = <Link href="/missionen" className="back-link"><span aria-hidden="true">←</span> {m.missions.back}</Link>;
  if (!missions) return <main className="module-page">{back}<p className="muted">{m.cockpit.starting}</p></main>;
  if (!mission) return <main className="module-page">{back}<p className="notice" role="alert">{m.missions.notFound}</p></main>;

  // Los botones desaparecen tras decidir: el foco pasa al título y se anuncia (WCAG 2.4.3).
  const onDone = (text: string) => {
    setAnnouncement(text);
    heading.current?.focus();
  };

  return (
    <main className="module-page" aria-labelledby="mission-title">
      {back}
      <header className="module-head">
        <div className="eyebrow">{m.missions.eyebrow}</div>
        <h1 id="mission-title" ref={heading} tabIndex={-1}>{mission.objective}</h1>
        <div className="mission-meta">
          <MissionStatusChip m={m} mission={mission} />
          <span className="muted">{m.missions.createdAt} {when(mission.createdAt)}</span>
          {mission.expected && <span className="muted">· {m.missions.expectedLabel}: {mission.expected}</span>}
        </div>
        <Actions m={m} mission={mission} onDone={onDone} />
        <p className="sr-only" role="status">{announcement}</p>
      </header>
      <div className="module-grid">
        <section className="card" aria-labelledby="plan-title">
          <h2 id="plan-title" className="card-title">{m.missions.planTitle}</h2>
          <MissionProgress m={m} mission={mission} />
          <ol className="step-list">
            {mission.steps.map((s) => (
              <li key={s.id} className={`step ${s.status}`} data-step={s.status}>
                <span className="step-dot" aria-hidden="true" />
                <div className="step-body">
                  <strong>{agentName(s.agentId, m)}</strong>
                  <span>{s.text}</span>
                </div>
                <span className={`state-chip ${s.status === 'working' ? 'working' : s.status === 'pending' ? 'idle' : ''}`}>{m.missions.stepStatus[s.status]}</span>
              </li>
            ))}
          </ol>
          <h2 className="card-title spaced">{m.missions.decisionsTitle}</h2>
          {mission.decisions.length === 0 ? <p className="empty-note">{m.missions.noDecisions}</p> : (
            <ul className="bullet-list">
              {mission.decisions.map((d, i) => (
                <li key={i}>
                  {format(d.kind === 'plan' ? m.missions.decisionPlan : m.missions.decisionResult, { result: d.approve ? m.missions.approved : m.missions.rejectedWord })} · {when(d.at)}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="report-title">
          <h2 id="report-title" className="card-title">
            {m.missions.reportTitle} {mission.status === 'awaiting-result' && <span className="draft-tag">{m.missions.reportDraft}</span>}
          </h2>
          {mission.report ? (
            <>
              <ReportView markdown={mission.report} />
              <button type="button" className="ghost-btn small" onClick={() => download(mission)}>{m.missions.download}</button>
            </>
          ) : (
            <p className="empty-note">{m.missions.reportPending}</p>
          )}
        </section>
      </div>
    </main>
  );
}
