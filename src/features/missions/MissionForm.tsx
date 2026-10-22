'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SnapshotResult } from '@/data/load';
import type { Messages } from '@/i18n';
import { EXPECTED_MAX, OBJECTIVE_MAX, REPORT_LENGTHS, type MissionInput } from '@/os/missions/contract';
import { useMissions, useSim } from '@/os/OsProvider';
import { contextFromSnapshot, projectsFromSnapshot } from './missionView';

/** Formulario «Neue Mission»: objetivo, resultado esperado y umfang del informe. */
export function MissionForm({ m, result }: Readonly<{ m: Messages; result: SnapshotResult }>) {
  const missions = useMissions((s) => s);
  const sim = useSim();
  const router = useRouter();
  const [objective, setObjective] = useState('');
  const [expected, setExpected] = useState('');
  const [length, setLength] = useState<MissionInput['length']>('mittel');
  const [error, setError] = useState<'invalid' | 'limit' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    // Un doble clic no crea dos misiones.
    if (!missions || submitting) return;
    const specialists = sim?.agents.filter((a) => a.kind === 'specialist').map((a) => a.id) ?? [];
    const created = missions.create({ objective, expected, length }, contextFromSnapshot(result), specialists, projectsFromSnapshot(result));
    if (!created.ok) {
      setError(created.reason);
      return;
    }
    setSubmitting(true);
    router.push(`/missionen/${created.id}`);
  };

  return (
    <form className="card mission-form" aria-labelledby="mission-form-title" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <h2 id="mission-form-title" className="card-title">{m.missions.newTitle}</h2>
      <label className="field-label" htmlFor="mission-objective">{m.missions.objective}</label>
      <input
        id="mission-objective"
        className="text-input"
        value={objective}
        maxLength={OBJECTIVE_MAX}
        placeholder={m.missions.objectivePlaceholder}
        aria-describedby="mission-objective-hint"
        aria-invalid={error === 'invalid'}
        onChange={(e) => { setObjective(e.target.value); setError(null); }}
      />
      <p id="mission-objective-hint" className={error ? 'field-error' : 'muted'} role={error ? 'alert' : undefined}>
        {error === 'invalid' ? m.missions.invalidObjective : error === 'limit' ? m.missions.limit : m.missions.objectiveHint}
      </p>
      <label className="field-label" htmlFor="mission-expected">{m.missions.expected}</label>
      <textarea id="mission-expected" className="text-input" rows={2} maxLength={EXPECTED_MAX} value={expected} placeholder={m.missions.expectedPlaceholder} onChange={(e) => setExpected(e.target.value)} />
      <fieldset className="radio-row">
        <legend className="field-label">{m.missions.length}</legend>
        {REPORT_LENGTHS.map((l) => (
          <label key={l} className={`radio-pill${length === l ? ' checked' : ''}`}>
            <input type="radio" name="mission-length" value={l} checked={length === l} onChange={() => setLength(l)} />
            {m.missions.lengths[l]}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="focus-btn" disabled={!missions || submitting}>{m.missions.start}</button>
    </form>
  );
}
