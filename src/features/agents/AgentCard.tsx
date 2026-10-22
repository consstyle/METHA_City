'use client';

import Link from 'next/link';
import { format, type Messages } from '@/i18n';
import { agentName, taskText } from '@/os/format';
import type { SimAgent } from '@/os/simulation/engine';
import { districtOf } from './directory';

/** Tarjeta de un agente en el directorio: tipo, dónde trabaja, estado y tarea. */
export function AgentCard({ m, agent }: Readonly<{ m: Messages; agent: SimAgent }>) {
  const name = agentName(agent.id, m);
  const district = districtOf(agent);
  const where =
    agent.kind === 'orchestrator'
      ? m.agents.chiefRole
      : agent.kind === 'specialist'
        ? `${m.specialists[agent.id as keyof Messages['specialists']]?.description ?? ''}`
        : `${district ? m.districts[district] : ''}`;

  return (
    <article className={`agent-card ${agent.kind}`} data-agent-card={agent.id} aria-labelledby={`agent-${agent.id}`}>
      <div className="agent-card-head">
        <span className="kind-tag">{m.kinds[agent.kind]}</span>
        <span className={`state-chip ${agent.state}`}>
          <span className={`state-dot ${agent.state}`} aria-hidden="true" />
          {m.agentState[agent.state]}
        </span>
      </div>
      <h2 id={`agent-${agent.id}`} className="agent-card-name">{name}</h2>
      <p className="agent-card-where">{where}</p>
      {agent.kind === 'specialist' && agent.unitId && (
        <p className="agent-card-serves">{format(m.directory.serves, { unit: agentName(agent.unitId, m) })}</p>
      )}
      <p className="agent-card-task">
        {agent.taskIndex === null ? <span className="muted">{m.agents.noTask}</span> : taskText(agent.id, agent.taskIndex, m)}
      </p>
      <div className="agent-card-actions">
        <Link className="ghost-btn small" href={`/agenten/${agent.id}`}>
          {m.directory.profile}<span className="sr-only"> · {name}</span>
        </Link>
        <Link className="ghost-btn small primary" href={`/chat?agent=${agent.id}`}>
          {m.directory.chat}<span className="sr-only"> · {name}</span>
        </Link>
      </div>
    </article>
  );
}
