'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { getMessages } from '@/i18n';
import { createChatStore, type ChatState, type ChatStore } from './chat/chatStore';
import { createSimulatedGateway } from './chat/gateway';
import { activeHires } from './hiring';
import { createAgentSettingsStore, createHiringStore, type AgentSettingsState, type AgentSettingsStore, type HiringStore, type HiringStoreState } from './hiringStore';
import { createOsStore, SIMULATION_INTERVAL_MS, type OsStore } from './osStore';
import type { SimState } from './simulation/engine';

interface OsStores {
  readonly os: OsStore;
  readonly hiring: HiringStore;
  readonly chat: ChatStore;
  readonly settings: AgentSettingsStore;
}

const OsStoreContext = createContext<OsStores | null>(null);

/** Almacenes vacíos para poder llamar a useStore sin condiciones mientras el sistema aún no existe. */
const EMPTY = {
  os: createOsStore({ seed: 0, now: () => new Date(0) }),
  hiring: createHiringStore({ getStore: () => null }),
  chat: createChatStore({ gateway: { reply: async () => ({ text: '', stopped: true }) }, getStore: () => null }),
  settings: createAgentSettingsStore({ getStore: () => null }),
};

function createStores(): OsStores {
  const m = getMessages();
  const os = createOsStore({ seed: 42, warmup: 24 });
  const hiring = createHiringStore();
  const sync = () => os.getState().syncSpecialists(activeHires(hiring.getState().hiring).map((h) => h.roleId));
  sync();
  hiring.subscribe(sync);
  const chat = createChatStore({ gateway: createSimulatedGateway(m), errorText: m.chat.error });
  return { os, hiring, chat, settings: createAgentSettingsStore() };
}

/** Si otra pestaña guarda cambios, se releen (si no, la última en guardar pisaría a la otra). */
function listenToOtherTabs(stores: OsStores): () => void {
  const reloaders: Readonly<Record<string, () => void>> = {
    'methacity.hiring.v1': () => stores.hiring.getState().reload(),
    'methacity.chat.v1': () => stores.chat.getState().reload(),
    'methacity.agents.v1': () => stores.settings.getState().reload(),
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key && Object.hasOwn(reloaders, e.key)) reloaders[e.key]?.();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/**
 * Crea el sistema de agentes solo en el navegador (tras montar): así el HTML del servidor y el
 * primer render del cliente coinciden y no hay errores de hidratación con horas, estados o
 * datos guardados en localStorage.
 */
export function OsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [stores, setStores] = useState<OsStores | null>(null);

  useEffect(() => {
    const created = createStores();
    setStores(created);
    const stopListening = listenToOtherTabs(created);
    const timer = window.setInterval(() => {
      if (!document.hidden) created.os.getState().tick();
    }, SIMULATION_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      stopListening();
      created.chat.getState().stop();
    };
  }, []);

  return <OsStoreContext.Provider value={stores}>{children}</OsStoreContext.Provider>;
}

function useSlice<S, T>(pick: (s: OsStores) => StoreApi<S>, selector: (state: S) => T): T | null {
  const stores = useContext(OsStoreContext);
  const value = useStore(pick(stores ?? EMPTY), selector);
  return stores ? value : null;
}

export function useOsStoreApi(): OsStore | null {
  return useContext(OsStoreContext)?.os ?? null;
}

export function useHiringStoreApi(): HiringStore | null {
  return useContext(OsStoreContext)?.hiring ?? null;
}

/**
 * Estado actual de la simulación, o null en el servidor y en el primer render.
 * Se devuelve el objeto completo (referencia estable por paso) y se deriva en el componente.
 */
export function useSim(): SimState | null {
  return useSlice((s) => s.os, (s) => s.sim);
}

export function useHiring<T>(selector: (s: HiringStoreState) => T): T | null {
  return useSlice((s) => s.hiring, selector);
}

export function useChat<T>(selector: (s: ChatState) => T): T | null {
  return useSlice((s) => s.chat, selector);
}

export function useAgentSettings<T>(selector: (s: AgentSettingsState) => T): T | null {
  return useSlice((s) => s.settings, selector);
}
