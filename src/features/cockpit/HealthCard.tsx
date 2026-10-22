import type { Messages } from '@/i18n';
import type { Health } from '@/os/contract';

/** Estado de los servicios. Hermes figura como «nicht verbunden» hasta B4. */
export function HealthCard({ m, health }: Readonly<{ m: Messages; health: Health }>) {
  return (
    <section className="card health-card" aria-labelledby="health-title">
      <h2 id="health-title" className="card-title">{m.health.title.toUpperCase()}</h2>
      <ul className="service-list">
        {health.services.map((s) => (
          <li key={s.id} data-service={s.id}>
            <span>{m.health.services[s.id]}</span>
            <span className={`service-status ${s.status}`}>
              <span className={`svc-dot ${s.status}`} aria-hidden="true" />
              {m.health.status[s.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
