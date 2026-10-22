'use client';

import { useRouter } from 'next/navigation';
import { useScenarioQuery } from '@/components/useScenarioQuery';
import { cityPlaceOf } from '@/features/agents/directory';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { agentName, agentTaskText } from '@/os/format';
import type { SimState } from '@/os/simulation/engine';

/** Tabla de agentes: estado, tarea y última actividad; cada fila lleva a su edificio. */
export function AgentsTable({ m, sim }: Readonly<{ m: Messages; sim: SimState | null }>) {
  const store = useCityStoreApi();
  const router = useRouter();
  const query = useScenarioQuery();
  const showInCity = (unitId: string) => {
    store.getState().select(unitId);
    store.getState().setView('city');
    router.push(`/${query}`);
  };

  return (
    <section className="card agents-card" aria-labelledby="agents-title">
      <h2 id="agents-title" className="card-title">{m.cockpit.agentsTitle}</h2>
      {!sim ? (
        <p className="muted">{m.cockpit.starting}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{m.cockpit.colAgent}</th>
              <th scope="col">{m.agents.state}</th>
              <th scope="col">{m.agents.task}</th>
              <th scope="col">{m.agents.lastActive}</th>
            </tr>
          </thead>
          <tbody>
            {sim.agents.map((a) => {
              const unit = a.unitId ? CAMPUS_UNITS.find((u) => u.id === a.unitId) : undefined;
              // Los equipos de proyecto se muestran en su obra (F5c).
              const place = cityPlaceOf(a);
              const sub = unit ? m.districts[unit.district] : a.kind === 'project' ? m.districts.project : m.agents.chiefRole;
              return (
                <tr key={a.id} data-agent={a.id}>
                  <td>
                    {place ? (
                      <button type="button" className="link-btn" title={m.cockpit.showInCity} onClick={() => showInCity(place)}>
                        {agentName(a.id, m)}
                        <span className="sr-only">: {m.cockpit.showInCity}</span>
                      </button>
                    ) : (
                      <strong>{agentName(a.id, m)}</strong>
                    )}
                    <small className="cell-sub">{sub}</small>
                  </td>
                  <td><span className={`state-chip ${a.state}`}><span className={`state-dot ${a.state}`} aria-hidden="true" />{m.agentState[a.state]}</span></td>
                  <td>{agentTaskText(a, m) || <span className="muted">{m.agents.noTask}</span>}</td>
                  <td className="nowrap">{a.lastActiveAt ? relativeTimeDe(a.lastActiveAt, new Date(sim.now)) : m.agents.never}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
