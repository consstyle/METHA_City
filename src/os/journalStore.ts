import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { createJsonStorage, type KeyValueStore } from '@/lib/storage';
import { appendJournal, JournalEntrySchema, JOURNAL_LIMIT, type JournalEntry } from './journal';

/** Una entrada dañada se descarta sola, sin perder el resto del diario. */
const PersistSchema = z.object({
  entries: z.array(z.unknown()).max(JOURNAL_LIMIT * 2).transform((items) => items.flatMap((x) => {
    const parsed = JournalEntrySchema.safeParse(x);
    return parsed.success ? [parsed.data] : [];
  })),
});

export interface JournalStoreState {
  readonly entries: readonly JournalEntry[];
  add(entries: readonly JournalEntry[]): void;
  reload(): void;
}

/** Diario persistente de la actividad (D21). Se fusiona con lo guardado por otras pestañas. */
export function createJournalStore({ getStore }: { getStore?: () => KeyValueStore | null } = {}) {
  const storage = createJsonStorage('methacity.journal', 1, PersistSchema, getStore);
  return createStore<JournalStoreState>()((set, get) => ({
    entries: storage.load()?.entries ?? [],
    add: (added) => {
      const known = new Set(get().entries.map((e) => e.id));
      if (added.every((e) => known.has(e.id))) return;
      const entries = appendJournal(storage.load()?.entries ?? get().entries, added);
      set({ entries });
      storage.save({ entries });
    },
    reload: () => set({ entries: storage.load()?.entries ?? [] }),
  }));
}

export type JournalStore = ReturnType<typeof createJournalStore>;
