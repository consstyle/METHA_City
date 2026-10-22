import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitsByDistrict } from '@/features/city/model/hierarchy';
import { DISTRICT_IDS } from '@/features/city/model/types';
import type { SnapshotResult } from '@/data/load';
import type { Messages } from '@/i18n';

/** Alertas de MethaDesk por distrito y unidad (montaje atrasado y retrabajo). */
export function MethadeskCard({ m, result }: Readonly<{ m: Messages; result: SnapshotResult }>) {
  const statuses = result.ok ? result.snapshot.units : [];
  return (
    <section className="card methadesk-card" aria-labelledby="methadesk-card-title">
      <h2 id="methadesk-card-title" className="card-title">{m.cockpit.methadeskTitle}</h2>
      {!result.ok && <p className="notice error" role="alert">{m.data.error}</p>}
      {result.ok && DISTRICT_IDS.map((district) => (
        <div key={district} className="district-block">
          <div className="district-name">{m.districts[district].toUpperCase()}</div>
          {unitsByDistrict(CAMPUS_UNITS, district).map((u) => {
            const s = statuses.find((x) => x.unitId === u.id);
            return (
              <div key={u.id} className="district-row">
                <span>{u.name}</span>
                {s?.hasData ? (
                  <span className="kpis">
                    <span className="kpi-chip">{s.ts.offen}/{s.ts.total} {m.panel.open}</span>
                    {s.alerts.montageUeberfaellig > 0 && <span className="badge r" title={m.panel.overdue}>{s.alerts.montageUeberfaellig}<span className="sr-only"> {m.panel.overdue}</span></span>}
                    {s.alerts.nachbearbeitung > 0 && <span className="badge o" title={m.panel.rework}>{s.alerts.nachbearbeitung}<span className="sr-only"> {m.panel.rework}</span></span>}
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
