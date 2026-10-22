'use client';

import { useRef } from 'react';
import { specialistById } from '@/features/city/model/specialists';
import { format, type Messages } from '@/i18n';
import { agentName } from '@/os/format';
import { pendingApprovals } from '@/os/hiring';
import type { HiringStoreState } from '@/os/hiringStore';

interface Props {
  readonly m: Messages;
  readonly hiring: HiringStoreState;
  /** Aviso para el lector de pantalla tras una decisión. */
  readonly announce: (text: string) => void;
}

/** Freigaben de contratación pendientes (D13: se deciden aquí hasta el módulo Freigaben de F5). */
export function ApprovalsCard({ m, hiring, announce }: Props) {
  const pending = pendingApprovals(hiring.hiring);
  const heading = useRef<HTMLHeadingElement>(null);
  // La fila decidida desaparece: el foco pasa al título de la tarjeta (WCAG 2.4.3).
  const decide = (id: string, approve: boolean, text: string) => {
    hiring.decide(id, approve);
    announce(format(approve ? m.directory.announceApproved : m.directory.announceRejected, { text }));
    heading.current?.focus();
  };
  return (
    <section className="card approvals-card" aria-labelledby="approvals-title">
      <h2 id="approvals-title" ref={heading} tabIndex={-1} className="card-title">
        {m.directory.approvalsTitle} {pending.length > 0 && <span className="count-badge">{pending.length}</span>}
      </h2>
      <p className="muted">{m.directory.approvalsNote}</p>
      {pending.length === 0 ? (
        <p className="empty-note">{m.directory.noApprovals}</p>
      ) : (
        <ul className="approval-list">
          {pending.map((a) => {
            const name = m.specialists[a.roleId].name;
            const unit = agentName(specialistById(a.roleId)?.unitId ?? null, m);
            const text = format(a.kind === 'hire' ? m.directory.approvalHire : m.directory.approvalRetire, { name, unit });
            return (
              <li key={a.id} className="approval-item" data-approval={a.id}>
                <span>{text}</span>
                <span className="approval-actions">
                  <button type="button" className="ghost-btn small primary" onClick={() => decide(a.id, true, text)} aria-label={`${m.directory.approve}: ${text}`}>
                    {m.directory.approve}
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => decide(a.id, false, text)} aria-label={`${m.directory.reject}: ${text}`}>
                    {m.directory.reject}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
