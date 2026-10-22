'use client';

import Link from 'next/link';
import { format, type Messages } from '@/i18n';
import { agentName } from '@/os/format';
import { neighbour, type BoardCard, type TaskColumn } from '@/os/tasks/tasks';

interface Props {
  readonly m: Messages;
  readonly card: BoardCard;
  /** `dir`: flecha usada, para devolver el foco a la misma flecha tras mover. */
  readonly onMove: (id: string, to: TaskColumn, dir?: 'left' | 'right') => void;
  readonly onRemove: (id: string) => void;
}

/** Tarjeta del Kanban. Las manuales se mueven con flechas o arrastrando; las de misión no. */
export function TaskCard({ m, card, onMove, onRemove }: Props) {
  const left = neighbour(card.status, -1);
  const right = neighbour(card.status, 1);
  const locked = card.missionId !== null;
  return (
    <li
      className={`task-card${locked ? ' locked' : ''}`}
      data-task={card.id}
      draggable={!locked}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <p className="task-title">{card.title}</p>
      <small className="cell-sub">{card.agentId ? agentName(card.agentId, m) : m.tasks.unassigned}</small>
      {locked ? (
        <Link className="task-mission" href={`/missionen/${card.missionId}`}>{m.tasks.fromMission}: {card.missionTitle}</Link>
      ) : (
        <div className="task-actions">
          <button type="button" className="chip-remove" data-dir="left" disabled={!left} aria-label={left ? format(m.tasks.moveLeft, { title: card.title, column: m.tasks.columns[left] }) : undefined} onClick={() => left && onMove(card.id, left, 'left')}>←</button>
          <button type="button" className="chip-remove" data-dir="right" disabled={!right} aria-label={right ? format(m.tasks.moveRight, { title: card.title, column: m.tasks.columns[right] }) : undefined} onClick={() => right && onMove(card.id, right, 'right')}>→</button>
          <button type="button" className="chip-remove" aria-label={format(m.tasks.remove, { title: card.title })} onClick={() => onRemove(card.id)}>×</button>
        </div>
      )}
    </li>
  );
}
