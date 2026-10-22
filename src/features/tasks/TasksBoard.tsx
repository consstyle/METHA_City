'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { filterAgents } from '@/features/agents/directory';
import { format, type Messages } from '@/i18n';
import { agentName } from '@/os/format';
import { useMissions, useSim, useTasks } from '@/os/OsProvider';
import { board, TASK_COLUMNS, TITLE_MAX, type TaskColumn } from '@/os/tasks/tasks';
import { TaskCard } from './TaskCard';

/** Módulo «Aufgaben» (D20): Kanban de 4 columnas con tareas manuales y pasos de misión. */
export function TasksBoard({ m }: Readonly<{ m: Messages }>) {
  const tasks = useTasks((s) => s);
  const missions = useMissions((s) => s.missions);
  const sim = useSim();
  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);
  const columns = useMemo(() => (tasks && missions ? board(tasks.board, missions) : null), [tasks, missions]);
  const agents = useMemo(() => (sim ? filterAgents(sim.agents, 'all') : []), [sim]);

  const pendingFocus = useRef<{ id: string; dir: 'left' | 'right' } | { column: TaskColumn } | null>(null);

  // La tarjeta cambia de lista (React la vuelve a montar): el foco vuelve a la flecha usada o, si ya
  // no se puede usar, a la tarjeta; tras borrar, al título de la columna (WCAG 2.4.3).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if ('column' in target) {
      document.getElementById(`col-${target.column}`)?.focus();
      return;
    }
    const card = document.querySelector<HTMLElement>(`[data-task="${CSS.escape(target.id)}"]`);
    const arrow = card?.querySelector<HTMLButtonElement>(`[data-dir="${target.dir}"]:not(:disabled)`);
    (arrow ?? card?.querySelector<HTMLButtonElement>('[data-dir]:not(:disabled)'))?.focus();
  }, [columns]);

  const findCard = (id: string) => (columns ? TASK_COLUMNS.flatMap((c) => columns[c]).find((x) => x.id === id) : undefined);
  const move = (id: string, to: TaskColumn, dir?: 'left' | 'right') => {
    const card = findCard(id);
    if (!card || card.missionId || card.status === to) return;
    if (dir) pendingFocus.current = { id, dir };
    tasks?.move(id, to);
    setAnnouncement(format(m.tasks.moved, { title: card.title, column: m.tasks.columns[to] }));
  };
  const remove = (id: string) => {
    const card = findCard(id);
    if (!card) return;
    pendingFocus.current = { column: card.status };
    tasks?.remove(id);
    setAnnouncement(format(m.tasks.removed, { title: card.title }));
  };
  const add = () => {
    if (tasks?.add(title, agentId || null)) {
      setTitle('');
      titleInput.current?.focus();
    }
  };

  return (
    <main className="module-page" aria-labelledby="tasks-title">
      <header className="module-head">
        <div className="eyebrow">{m.tasks.eyebrow}</div>
        <h1 id="tasks-title">{m.tasks.titleLine1}<br />{m.tasks.titleLine2}</h1>
        <p className="muted">{m.tasks.missionHint} {m.tasks.dragHint}</p>
      </header>
      <form className="card task-form" aria-label={m.tasks.newTask} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="task-form-row">
          <div className="grow">
            <label className="field-label" htmlFor="task-title">{m.tasks.titleLabel}</label>
            <input id="task-title" ref={titleInput} className="text-input" maxLength={TITLE_MAX} value={title} placeholder={m.tasks.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="task-agent">{m.tasks.assignee}</label>
            <select id="task-agent" className="text-input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{m.tasks.unassigned}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{agentName(a.id, m)}</option>)}
            </select>
          </div>
          <button type="submit" className="focus-btn add-btn" disabled={!tasks || !title.trim()}>{m.tasks.add}</button>
        </div>
      </form>
      <div className="kanban">
        {TASK_COLUMNS.map((c) => (
          <section
            key={c}
            className="kanban-col"
            aria-labelledby={`col-${c}`}
            data-column={c}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              move(e.dataTransfer.getData('text/plain'), c);
            }}
          >
            <h2 id={`col-${c}`} tabIndex={-1} className="card-title">{m.tasks.columns[c]} <span className="col-count">{columns?.[c].length ?? 0}</span></h2>
            {columns?.[c].length === 0 && <p className="empty-note">{m.tasks.empty}</p>}
            <ul className="task-list">
              {columns?.[c].map((card) => <TaskCard key={card.id} m={m} card={card} onMove={move} onRemove={remove} />)}
            </ul>
          </section>
        ))}
      </div>
      <p className="sr-only" role="status">{announcement}</p>
    </main>
  );
}
