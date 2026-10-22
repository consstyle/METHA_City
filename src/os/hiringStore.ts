import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { createJsonStorage, type KeyValueStore } from '@/lib/storage';
import {
  canHire, decide, EMPTY_HIRING, HiringStateSchema, pendingApprovals, requestHire, requestRetire, type HireCheck, type HiringState,
} from './hiring';

interface StoreOptions {
  readonly now?: () => Date;
  readonly getStore?: () => KeyValueStore | null;
}

export interface HiringStoreState {
  readonly hiring: HiringState;
  /** Pide un especialista; devuelve el motivo si no es posible. */
  request(roleId: string): HireCheck;
  retire(roleId: string): boolean;
  decide(approvalId: string, approve: boolean): boolean;
  /** Vuelve a leer lo guardado (otra pestaña lo cambió). */
  reload(): void;
}

/** Contrataciones y sus Freigaben (D13), persistidas en el navegador (D15). */
export function createHiringStore({ now = () => new Date(), getStore }: StoreOptions = {}) {
  const storage = createJsonStorage('methacity.hiring', 1, HiringStateSchema, getStore);
  return createStore<HiringStoreState>()((set, get) => {
    const commit = (hiring: HiringState) => {
      set({ hiring });
      storage.save(hiring);
    };
    /** Cada acción parte de lo último guardado (quizá por otra pestaña) para no pisarlo. */
    const latest = () => storage.load() ?? get().hiring;
    return {
      hiring: storage.load() ?? EMPTY_HIRING,
      request: (roleId) => {
        const hiring = latest();
        const check = canHire(hiring, roleId);
        if (check === 'ok') commit(requestHire(hiring, roleId, now()));
        return check;
      },
      retire: (roleId) => {
        const hiring = latest();
        const active = hiring.hires.some((h) => h.roleId === roleId && h.status === 'active');
        if (!active || pendingApprovals(hiring).some((a) => a.roleId === roleId)) return false;
        commit(requestRetire(hiring, roleId, now()));
        return true;
      },
      decide: (approvalId, approve) => {
        const hiring = latest();
        if (!pendingApprovals(hiring).some((a) => a.id === approvalId)) return false;
        commit(decide(hiring, approvalId, approve, now()));
        return true;
      },
      reload: () => set({ hiring: storage.load() ?? EMPTY_HIRING }),
    };
  });
}

export type HiringStore = ReturnType<typeof createHiringStore>;

export const INSTRUCTIONS_MAX = 2_000;
const SettingsSchema = z.object({ instructions: z.record(z.string(), z.string().max(INSTRUCTIONS_MAX)) });

export interface AgentSettingsState {
  readonly instructions: Readonly<Record<string, string>>;
  /** null = se usan las instrucciones por defecto. */
  instructionsFor(agentId: string): string | null;
  setInstructions(agentId: string, text: string): void;
  reload(): void;
}

/** Instrucciones permanentes de cada agente (perfil, F4). */
export function createAgentSettingsStore({ getStore }: Pick<StoreOptions, 'getStore'> = {}) {
  const storage = createJsonStorage('methacity.agents', 1, SettingsSchema, getStore);
  return createStore<AgentSettingsState>()((set, get) => ({
    instructions: storage.load()?.instructions ?? {},
    instructionsFor: (agentId) => get().instructions[agentId] ?? null,
    setInstructions: (agentId, raw) => {
      const text = raw.trim();
      if (text.length > INSTRUCTIONS_MAX) throw new Error(`instructions too long (${text.length})`);
      const rest = Object.fromEntries(Object.entries(get().instructions).filter(([id]) => id !== agentId));
      const instructions = text ? { ...rest, [agentId]: text } : rest;
      set({ instructions });
      storage.save({ instructions });
    },
    reload: () => set({ instructions: storage.load()?.instructions ?? {} }),
  }));
}

export type AgentSettingsStore = ReturnType<typeof createAgentSettingsStore>;
