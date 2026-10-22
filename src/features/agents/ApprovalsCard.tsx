'use client';

import Link from 'next/link';
import { format, type Messages } from '@/i18n';
import { pendingApprovals } from '@/os/hiring';
import type { HiringStoreState } from '@/os/hiringStore';

/** Las Freigaben de contratación se deciden en el módulo Freigaben (D19); aquí solo se avisa. */
export function ApprovalsCard({ m, hiring }: Readonly<{ m: Messages; hiring: HiringStoreState }>) {
  const pending = pendingApprovals(hiring.hiring).length;
  return (
    <section className="card approvals-card" aria-labelledby="approvals-title">
      <h2 id="approvals-title" className="card-title">
        {m.directory.approvalsTitle} {pending > 0 && <span className="count-badge">{pending}</span>}
      </h2>
      <p className="muted">{pending > 0 ? format(m.approvals.agentsPointer, { n: pending }) : m.approvals.agentsPointerNone}</p>
      <Link className="ghost-btn small primary" href="/freigaben">{m.nav.approvals} <span aria-hidden="true">→</span></Link>
    </section>
  );
}
