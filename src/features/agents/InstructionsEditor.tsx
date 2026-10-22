'use client';

import { useEffect, useState } from 'react';
import { format, type Messages } from '@/i18n';
import { INSTRUCTIONS_MAX } from '@/os/hiringStore';
import { useAgentSettings } from '@/os/OsProvider';

/** Instrucciones permanentes del agente, guardadas en este navegador (D15). */
export function InstructionsEditor({ m, agentId, agentLabel }: Readonly<{ m: Messages; agentId: string; agentLabel: string }>) {
  const saved = useAgentSettings((s) => s.instructions[agentId] ?? null);
  const settings = useAgentSettings((s) => s);
  const current = saved ?? m.profile.defaultInstructions;
  const [draft, setDraft] = useState(current);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => setDraft(current), [current]);

  const save = () => {
    settings?.setInstructions(agentId, draft === m.profile.defaultInstructions ? '' : draft);
    setStatus('saved');
  };

  return (
    <section className="card" aria-labelledby="instructions-title">
      <h2 id="instructions-title" className="card-title">{m.profile.instructions}</h2>
      <textarea
        className="text-input"
        rows={4}
        maxLength={INSTRUCTIONS_MAX}
        value={draft}
        disabled={!settings}
        aria-label={format(m.profile.instructionsLabel, { agent: agentLabel })}
        aria-describedby="instructions-hint"
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus('idle');
        }}
      />
      <p id="instructions-hint" className="muted">{m.profile.instructionsHint}</p>
      <div className="row-actions">
        <button type="button" className="ghost-btn small primary" disabled={!settings || draft === current} onClick={save}>{m.profile.save}</button>
        <button
          type="button"
          className="ghost-btn small"
          disabled={!settings || saved === null}
          onClick={() => {
            settings?.setInstructions(agentId, '');
            setStatus('idle');
          }}
        >
          {m.profile.resetInstructions}
        </button>
        <span className="save-status" role="status">{status === 'saved' ? m.profile.saved : ''}</span>
      </div>
    </section>
  );
}
