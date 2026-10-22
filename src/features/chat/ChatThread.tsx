'use client';

import { useEffect, useRef } from 'react';
import { format, INTL_LOCALE, type Messages } from '@/i18n';
import { timeInZurich } from '@/lib/dates';
import type { Conversation } from '@/os/chat/contract';

interface Props {
  readonly m: Messages;
  readonly agentLabel: string;
  readonly conversation: Conversation | null;
  /** Texto parcial de la respuesta que se está escribiendo en esta conversación. */
  readonly streaming: string | null;
}

/** Distancia (px) al final a partir de la cual se considera que el usuario está leyendo más arriba. */
const STICK_THRESHOLD = 80;

/**
 * Hilo de mensajes. Es un `role="log"`: el lector anuncia cada mensaje nuevo, pero no el texto
 * parcial mientras se escribe (sería ruido); para eso hay un aviso corto «… schreibt», fuera del
 * log y siempre montado.
 */
export function ChatThread({ m, agentLabel, conversation, streaming }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const count = conversation?.messages.length ?? 0;

  // Solo se desplaza el hilo (no la página) y solo si el usuario ya estaba al final.
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count, streaming, conversation?.id]);

  return (
    <>
      <div
        ref={box}
        className="thread"
        role="log"
        aria-label={format(m.chat.threadLabel, { agent: agentLabel })}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
        }}
      >
        {count === 0 && streaming === null && <p className="empty-note thread-empty">{format(m.chat.emptyThread, { agent: agentLabel })}</p>}
        {conversation?.messages.map((msg) => (
          <div key={msg.id} className={`bubble ${msg.role}${msg.stopped ? ' stopped' : ''}`} data-role={msg.role}>
            <div className="bubble-meta">
              <span>{msg.role === 'user' ? m.chat.you : agentLabel}</span>
              <time dateTime={msg.at}>{timeInZurich(msg.at, INTL_LOCALE)}</time>
            </div>
            <p className="bubble-text">{msg.text}</p>
            {msg.attachments.length > 0 && (
              <ul className="bubble-files">{msg.attachments.map((a, i) => <li key={`${a.name}-${i}`}>▤ {a.name}</li>)}</ul>
            )}
            {msg.stopped && <span className="bubble-flag">{m.chat.stopped}</span>}
          </div>
        ))}
        {streaming !== null && (
          <div className="bubble agent streaming" aria-hidden="true">
            <div className="bubble-meta"><span>{agentLabel}</span></div>
            <p className="bubble-text">{streaming}<span className="caret" /></p>
          </div>
        )}
      </div>
      <p className="sr-only" role="status">{streaming !== null ? format(m.chat.writing, { agent: agentLabel }) : ''}</p>
    </>
  );
}
