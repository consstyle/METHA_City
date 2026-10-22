'use client';

import { useRef } from 'react';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { SPECIALISTS } from '@/features/city/model/specialists';
import { format, type Messages } from '@/i18n';
import type { HiringStoreState } from '@/os/hiringStore';
import { catalogStatus, freeLots, type CatalogStatus } from './directory';

const unitName = (id: string) => CAMPUS_UNITS.find((u) => u.id === id)?.name ?? id;

function Action({ m, status, name, onRequest, onRetire }: Readonly<{
  m: Messages; status: CatalogStatus; name: string; onRequest: () => void; onRetire: () => void;
}>) {
  if (status === 'available') {
    return <button type="button" className="ghost-btn small primary" onClick={onRequest} aria-label={format(m.directory.requestLabel, { name })}>{m.directory.request}</button>;
  }
  if (status === 'active') {
    return <button type="button" className="ghost-btn small" onClick={onRetire} aria-label={format(m.directory.retireLabel, { name })}>{m.directory.retire}</button>;
  }
  const text = status === 'no-lot' ? m.directory.noLot : m.directory.pending;
  return <span className={`catalog-status ${status}`}>{text}</span>;
}

interface Props {
  readonly m: Messages;
  readonly hiring: HiringStoreState;
  /** Aviso para el lector de pantalla tras una acción. */
  readonly announce: (text: string) => void;
}

/** Catálogo de los 14 especialistas (D8) con solicitud y retirada sujetas a Freigabe (D13). */
export function SpecialistCatalog({ m, hiring, announce }: Props) {
  const lots = freeLots(hiring.hiring);
  const heading = useRef<HTMLHeadingElement>(null);
  // El botón pulsado desaparece: el foco pasa al título de la tarjeta (WCAG 2.4.3).
  const act = (run: () => unknown, text: string) => {
    run();
    announce(format(m.directory.announceRequested, { text }));
    heading.current?.focus();
  };
  return (
    <section className="card catalog-card" aria-labelledby="catalog-title">
      <h2 id="catalog-title" ref={heading} tabIndex={-1} className="card-title">{m.directory.catalogTitle}</h2>
      <p className="muted">{m.directory.catalogIntro}</p>
      <p className="lots-note">{format(m.directory.lots, lots)}</p>
      <ul className="catalog-list">
        {SPECIALISTS.map((s) => {
          const name = m.specialists[s.id].name;
          const status = catalogStatus(hiring.hiring, s.id, s.district);
          return (
            <li key={s.id} className={`catalog-item ${status}`} data-role={s.id}>
              <div className="catalog-text">
                <strong>{name}</strong>
                <small>{m.specialists[s.id].description}</small>
                <small className="cell-sub">{format(m.directory.serves, { unit: unitName(s.unitId) })} · {m.districts[s.district]}</small>
              </div>
              <Action
                m={m}
                status={status}
                name={name}
                onRequest={() => act(() => hiring.request(s.id), format(m.directory.approvalHire, { name, unit: unitName(s.unitId) }))}
                onRetire={() => act(() => hiring.retire(s.id), format(m.directory.approvalRetire, { name }))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
