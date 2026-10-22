import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitsByDistrict } from '@/features/city/model/hierarchy';
import { DISTRICT_IDS } from '@/features/city/model/types';
import type { ProjectStatus } from '@/data/contract';
import type { SnapshotResult } from '@/data/load';
import type { Messages } from '@/i18n';

function Alerts({ m, overdue, rework }: Readonly<{ m: Messages; overdue: number; rework: number }>) {
  return (
    <>
      {overdue > 0 && <span className="badge r" title={m.panel.overdue}>{overdue}<span className="sr-only"> {m.panel.overdue}</span></span>}
      {rework > 0 && <span className="badge o" title={m.panel.rework}>{rework}<span className="sr-only"> {m.panel.rework}</span></span>}
    </>
  );
}

/** Obras de los proyectos activos (F5c): Teilsysteme verbaut y alarmas de cada proyecto. */
function ProjectRows({ m, projects }: Readonly<{ m: Messages; projects: readonly ProjectStatus[] }>) {
  if (projects.length === 0) return <div className="district-row"><span className="no-data">{m.hierarchy.noSites}</span></div>;
  return projects.map((p) => (
    <div key={p.projektId} className="district-row">
      <span>{p.projektname}</span>
      <span className="kpis">
        <span className="kpi-chip">{p.tsVerbaut}/{p.tsTotal} {m.cockpit.verbaut}</span>
        <Alerts m={m} overdue={p.montageUeberfaellig} rework={p.nachbearbeitung} />
      </span>
    </div>
  ));
}

/** Alertas de MethaDesk por distrito: edificios del campus y obras de los proyectos. */
export function MethadeskCard({ m, result }: Readonly<{ m: Messages; result: SnapshotResult }>) {
  const statuses = result.ok ? result.snapshot.units : [];
  return (
    <section className="card methadesk-card" aria-labelledby="methadesk-card-title">
      <h2 id="methadesk-card-title" className="card-title">{m.cockpit.methadeskTitle}</h2>
      {!result.ok && <p className="notice error" role="alert">{m.data.error}</p>}
      {result.ok && DISTRICT_IDS.map((district) => (
        <div key={district} className="district-block">
          <div className="district-name">{m.districts[district].toUpperCase()}</div>
          {district === 'project' && <ProjectRows m={m} projects={result.snapshot.projects} />}
          {unitsByDistrict(CAMPUS_UNITS, district).map((u) => {
            const s = statuses.find((x) => x.unitId === u.id);
            return (
              <div key={u.id} className="district-row">
                <span>{u.name}</span>
                {s?.hasData ? (
                  <span className="kpis">
                    <span className="kpi-chip">{s.ts.offen}/{s.ts.total} {m.panel.open}</span>
                    <Alerts m={m} overdue={s.alerts.montageUeberfaellig} rework={s.alerts.nachbearbeitung} />
                  </span>
                ) : (
                  <span className="no-data">{m.panel.noData}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
