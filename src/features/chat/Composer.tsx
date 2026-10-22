'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { format, type Messages } from '@/i18n';
import { MESSAGE_MAX } from '@/os/chat/contract';
import type { Attachment } from '@/os/chat/replies';

const MAX_ATTACHMENTS = 10;
const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`);

interface Props {
  readonly m: Messages;
  readonly agentLabel: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onSend: (text: string, attachments: readonly Attachment[]) => void;
  readonly onStop: () => void;
}

/** Caja de escritura: Intro envía, Mayús+Intro salta de línea; adjuntos solo por nombre y tamaño (D16). */
export function Composer({ m, agentLabel, busy, disabled, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<readonly Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const canSend = !busy && !disabled && text.trim().length > 0;

  // «Senden» y «Stopp» se sustituyen entre sí: el foco vuelve a la caja para no perderse (WCAG 2.4.3).
  const submit = () => {
    if (!canSend) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
    input.current?.focus();
  };
  const stop = () => {
    onStop();
    input.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {attachments.length > 0 && (
        <ul className="attachment-chips" aria-describedby="attachments-note">
          {attachments.map((a, i) => (
            <li key={`${a.name}-${i}`} className="chip">
              <span>{a.name} · {formatSize(a.size)}</span>
              <button type="button" className="chip-remove" aria-label={format(m.chat.removeAttachment, { name: a.name })} onClick={() => { setAttachments(attachments.filter((_, j) => j !== i)); input.current?.focus(); }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {attachments.length > 0 && <p id="attachments-note" className="muted">{m.chat.attachmentsNote}</p>}
      <div className="composer-row">
        <button type="button" className="icon" aria-label={m.chat.attach} title={m.chat.attach} disabled={disabled || attachments.length >= MAX_ATTACHMENTS} onClick={() => fileInput.current?.click()}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" /></svg>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          onChange={(e) => {
            // D16: solo nombre y tamaño; el contenido no se lee ni se sube.
            const picked = [...(e.target.files ?? [])].map((f) => ({ name: f.name.slice(0, 255), size: f.size }));
            setAttachments([...attachments, ...picked].slice(0, MAX_ATTACHMENTS));
            e.target.value = '';
          }}
        />
        <textarea
          ref={input}
          className="text-input composer-input"
          rows={2}
          maxLength={MESSAGE_MAX}
          value={text}
          disabled={disabled}
          placeholder={format(m.chat.placeholder, { agent: agentLabel })}
          aria-label={m.chat.inputLabel}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <button type="button" className="ghost-btn stop-btn" onClick={stop}>{m.chat.stop}</button>
        ) : (
          <button type="submit" className="focus-btn send-btn" disabled={!canSend}>{m.chat.send}</button>
        )}
      </div>
    </form>
  );
}
