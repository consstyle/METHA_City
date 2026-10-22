'use client';

import Link from 'next/link';
import type { SnapshotResult } from '@/data/load';
import type { Messages } from '@/i18n';
import { useMissions } from '@/os/OsProvider';
import { MissionForm } from './MissionForm';
import { MissionProgress, MissionStatusChip } from './MissionStatus';

/** Módulo «Missionen»: nueva misión y lista de todas (F5). */
export function MissionsModule({ m, result }: Readonly<{ m: Messages; result: SnapshotResult }>) {
  const missions = useMissions((s) => s.missions);
  return (
    <main className="module-page" aria-labelledby="missions-title">
      <header className="module-head">
        <div className="eyebrow">{m.missions.eyebrow}</div>
        <h1 id="missions-title">{m.missions.titleLine1}<br />{m.missions.titleLine2}</h1>
        <p className="sim-note"><span className="sim-tag">{m.sim.badge}</span> {m.cockpit.simulation}</p>
      </header>
      <div className="module-grid">
        <MissionForm m={m} result={result} />
        <section className="card" aria-labelledby="missions-list-title">
          <h2 id="missions-list-title" className="card-title">{m.missions.listTitle}</h2>
          {!missions && <p className="muted">{m.cockpit.starting}</p>}
          {missions?.length === 0 && <p className="empty-note">{m.missions.empty}</p>}
          <ul className="mission-list">
            {missions?.map((mission) => (
              <li key={mission.id} className="mission-item" data-mission={mission.id}>
                <div className="mission-item-head">
                  <Link href={`/missionen/${mission.id}`} className="mission-link">{mission.objective}</Link>
                  <MissionStatusChip m={m} mission={mission} />
                </div>
                <MissionProgress m={m} mission={mission} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
