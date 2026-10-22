/** Entrega de respuestas «en streaming» palabra a palabra, como lo hará Hermes por SSE (B4). */

export interface Scheduler {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

const browserScheduler: Scheduler = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (id) => window.clearTimeout(id),
};

/** Trozos de texto (palabra + espacio siguiente) cuya concatenación es el texto original. */
export function chunkText(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

export interface StreamOptions {
  /** Recibe el texto acumulado tras cada trozo. */
  readonly onChunk: (sofar: string) => void;
  readonly signal?: AbortSignal;
  readonly delayMs?: number;
  readonly scheduler?: Scheduler;
}

export interface StreamResult {
  readonly text: string;
  readonly stopped: boolean;
}

export function streamText(text: string, { onChunk, signal, delayMs = 40, scheduler = browserScheduler }: StreamOptions): Promise<StreamResult> {
  const chunks = chunkText(text);
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve({ text: '', stopped: true });
    let sofar = '';
    let index = 0;
    let timer: number | null = null;
    const onAbort = () => {
      if (timer !== null) scheduler.clear(timer);
      resolve({ text: sofar, stopped: true });
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const tick = () => {
      sofar += chunks[index] ?? '';
      index += 1;
      onChunk(sofar);
      if (index < chunks.length) {
        timer = scheduler.set(tick, delayMs);
        return;
      }
      signal?.removeEventListener('abort', onAbort);
      resolve({ text: sofar, stopped: false });
    };
    if (chunks.length === 0) return resolve({ text: '', stopped: false });
    timer = scheduler.set(tick, delayMs);
  });
}
