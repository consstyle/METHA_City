'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useScenarioQuery } from '@/components/useScenarioQuery';
import { useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';
import { relativeTimeDe } from '@/lib/relativeTime';
import { profileOf } from '@/os/chat/profile';
import { activityText, agentName, agentTaskText } from '@/os/format';
import { useChat, useHiring, useSim } from '@/os/OsProvider';
import type { SimAgent } from '@/os/simulation/engine';
import { districtOf } from './directory';
import { InstructionsEditor } from './InstructionsEditor';

const HISTORY_SIZE = 10;

function roleLine(agent: SimAgent, m: Messages): string {
  if (agent.kind === 'orchestrator') return m.agents.chiefRole;
  if (agent.kind === 'specialist') return m.specialists[agent.id as keyof Messages['specialists']]?.description ?? '';
  return agent.unitId ? m.units[agent.unitId].role : '';
}

/** Perfil de un agente (F4): identidad, papel, instrucciones, memoria, archivos e historial. */
export function AgentProfile({ m, agentId }: Readonly<{ m: Messages; agentId: string }>) {
  const sim = useSim();
  const conversations = useChat((s) => s.conversations);
  const pendingHire = useHiring((s) => s.hiring.hires.some((h) => h.roleId === agentId && h.status === 'pending')) ?? false;
  const city = useCityStoreApi();
  const router = useRouter();
  const query = useScenarioQuery();
  const agent = sim?.agents.find((a) => a.id === agentId);
  const profile = useMemo(() => profileOf(agentId, m), [agentId, m]);
  const history = useMemo(
    () => (sim ? sim.activity.filter((e) => e.agentId === agentId || e.targetAgentId === agentId).slice(-HISTORY_SIZE).reverse() : []),
    [sim, agentId],
  );

  const back = <Link href="/agenten" className="back-link"><span aria-hidden="true">←</span> {m.profile.back}</Link>;
  if (!sim) return <main className="module-page">{back}<p className="muted">{m.cockpit.starting}</p></main>;
  if (!agent) {
    return <main className="module-page">{back}<p className="notice" role="alert">{pendingHire ? m.profile.pendingHire : m.profile.notFound}</p></main>;
  }

  const name = agentName(agent.id, m);
  const district = districtOf(agent);
  const chats = conversations?.filter((c) => c.agentId === agent.id).length ?? 0;
  const showInCity = () => {
    if (!agent.unitId) return;
    city.getState().select(agent.unitId);
    city.getState().setView('city');
    router.push(`/${query}`);
  };

  return (
    <main className="module-page" aria-labelledby="profile-title">
      {back}
      <header className="module-head profile-head">
        <span className="kind-tag">{m.kinds[agent.kind]}</span>
        <h1 id="profile-title">{name}</h1>
        <p className="role">{roleLine(agent, m)}</p>
      </header>
      <div className="module-grid">
        <section className="card" aria-labelledby="identity-title">
          <h2 id="identity-title" className="card-title">{m.panel.agentTitle} <span className="sim-tag">{m.sim.badge}</span></h2>
          <dl className="facts">
            <div><dt>{m.agents.state}</dt><dd><span className={`state-dot ${agent.state}`} aria-hidden="true" /> {m.agentState[agent.state]}</dd></div>
            <div><dt>{m.agents.task}</dt><dd>{agentTaskText(agent, m) || m.agents.noTask}</dd></div>
            <div><dt>{m.agents.lastActive}</dt><dd>{agent.lastActiveAt ? relativeTimeDe(agent.lastActiveAt, new Date(sim.now)) : m.agents.never}</dd></div>
            {district && <div><dt>{m.profile.district}</dt><dd>{m.districts[district]}</dd></div>}
            {agent.unitId && <div><dt>{agent.kind === 'specialist' ? m.profile.servesUnit : m.profile.unit}</dt><dd>{agentName(agent.unitId, m)}</dd></div>}
            <div><dt>{m.profile.conversations}</dt><dd>{chats}</dd></div>
          </dl>
          <div className="row-actions">
            <Link className="ghost-btn small primary" href={`/chat?agent=${agent.id}`}>{m.profile.openChat}</Link>
            {agent.unitId && <button type="button" className="ghost-btn small" onClick={showInCity}>{m.profile.showInCity}</button>}
          </div>
        </section>
        <section className="card" aria-labelledby="resp-title">
          <h2 id="resp-title" className="card-title">{m.profile.responsibilities}</h2>
          <ul className="bullet-list">{profile.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
          <h2 className="card-title spaced">{m.profile.memory}</h2>
          <ul className="bullet-list">{profile.memory.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
        <InstructionsEditor m={m} agentId={agent.id} agentLabel={name} />
        <section className="card" aria-labelledby="files-title">
          <h2 id="files-title" className="card-title">{m.profile.files}</h2>
          <ul className="file-list">{profile.files.map((f) => <li key={f}><span className="file-icon" aria-hidden="true">▤</span>{f}</li>)}</ul>
          <p className="muted">{m.profile.filesNote}</p>
        </section>
        <section className="card wide" aria-labelledby="history-title">
          <h2 id="history-title" className="card-title">{m.profile.history}</h2>
          {history.length === 0 ? <p className="empty-note">{m.profile.noHistory}</p> : (
            <ol className="feed">
              {history.map((e) => (
                <li key={e.id} className={`feed-item ${e.type}`}>
                  <span className="feed-dot" aria-hidden="true" />
                  <span className="feed-text">{activityText(e, m)}</span>
                  <time className="feed-time" dateTime={e.at}>{relativeTimeDe(e.at, new Date(sim.now))}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
