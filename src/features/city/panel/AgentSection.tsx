'use client';

import Link from 'next/link';
import type { Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { agentTaskText } from '@/os/format';
import { useSim } from '@/os/OsProvider';

/**
 * Estado del agente de la unidad: qué hace, desde cuándo, y acceso a su perfil y al chat.
 * `title`: rótulo de la sección (en una obra hay dos agentes: Projektleitung y Bauleitung).
 */
export function AgentSection({ m, agentId, title }: Readonly<{ m: Messages; agentId: string; title?: string }>) {
  const sim = useSim();
  const agent = sim?.agents.find((a) => a.id === agentId);
  const titleId = `agent-title-${agentId}`;
  return (
    <section className="panel-section" aria-labelledby={titleId}>
      <h3 id={titleId} className="section-label">
        {title ?? m.panel.agentTitle} <span className="sim-tag">{m.sim.badge}</span>
      </h3>
      {!sim || !agent ? (
        <p className="muted">{m.cockpit.starting}</p>
      ) : (
        <dl className="facts">
          <div>
            <dt>{m.agents.state}</dt>
            <dd><span className={`state-dot ${agent.state}`} aria-hidden="true" /> {m.agentState[agent.state]}</dd>
          </div>
          <div>
            <dt>{m.agents.task}</dt>
            <dd>{agentTaskText(agent, m) || m.agents.noTask}</dd>
          </div>
          <div>
            <dt>{m.agents.lastActive}</dt>
            <dd>{agent.lastActiveAt ? relativeTimeDe(agent.lastActiveAt, new Date(sim.now)) : m.agents.never}</dd>
          </div>
        </dl>
      )}
      <div className="row-actions">
        <Link className="ghost-btn small primary" href={`/chat?agent=${agentId}`}>{m.panel.chat}</Link>
        <Link className="ghost-btn small" href={`/agenten/${agentId}`}>{m.directory.profile}</Link>
      </div>
    </section>
  );
}
