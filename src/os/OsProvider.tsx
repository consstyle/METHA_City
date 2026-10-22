'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { getMessages } from '@/i18n';
import { createChatStore, type ChatState, type ChatStore } from './chat/chatStore';
import { createSimulatedGateway } from './chat/gateway';
import { activeHires } from './hiring';
import { createAgentSettingsStore, createHiringStore, type AgentSettingsState, type AgentSettingsStore, type HiringStore, type HiringStoreState } from './hiringStore';
import { hiringJournal, missionJournal } from './journal';
import { createJournalStore, type JournalStore, type JournalStoreState } from './journalStore';
import { pinsOf } from './missions/mission';
import { createMissionsStore, type MissionsState, type MissionsStore } from './missions/missionsStore';
import { createOsStore, SIMULATION_INTERVAL_MS, type OsStore } from './osStore';
import type { SimState } from './simulation/engine';
import { createTasksStore, type TasksStore, type TasksStoreState } from './tasks/tasksStore';

interface OsStores {
  readonly os: OsStore;
  readonly hiring: HiringStore;
  readonly chat: ChatStore;
  readonly settings: AgentSettingsStore;
  readonly missions: MissionsStore;
  readonly tasks: TasksStore;
  readonly journal: JournalStore;
}

const OsStoreContext = createContext<OsStores | null>(null);

const offline = () => null;
/** Almacenes vacíos para poder llamar a useStore sin condiciones mientras el sistema aún no existe. */
const EMPTY: OsStores = {
  os: createOsStore({ seed: 0, now: () => new Date(0) }),
  hiring: createHiringStore({ getStore: offline }),
  chat: createChatStore({ gateway: { reply: async () => ({ text: '', stopped: true }) }, getStore: offline }),
  settings: createAgentSettingsStore({ getStore: offline }),
  missions: createMissionsStore({ m: getMessages(), getStore: offline }),
  tasks: createTasksStore({ getStore: offline }),
  journal: createJournalStore({ getStore: offline }),
};

/**
 * Conecta los almacenes: contrataciones y misiones mandan sobre la simulación y llenan el diario.
 * Devuelve la función que deshace las suscripciones.
 */
function connect({ os, hiring, missions, journal }: OsStores): () => void {
  const m = getMessages();
  const syncSpecialists = () => os.getState().syncSpecialists(activeHires(hiring.getState().hiring).map((h) => h.roleId));
  const syncPins = () => os.getState().setPins(pinsOf(missions.getState().missions));
  let prevHiring = hiring.getState().hiring;
  const offHiring = hiring.subscribe((s) => {
    journal.getState().add(hiringJournal(prevHiring, s.hiring, m));
    prevHiring = s.hiring;
    syncSpecialists();
  });
  let prevMissions = missions.getState().missions;
  const offMissions = missions.subscribe((s) => {
    journal.getState().add(missionJournal(prevMissions, s.missions, m));
    prevMissions = s.missions;
    syncPins();
  });
  syncSpecialists();
  os.getState().record(missions.getState().tick());
  syncPins();
  return () => {
    offHiring();
    offMissions();
  };
}

function createStores(): { stores: OsStores; disconnect: () => void } {
  const m = getMessages();
  const os = createOsStore({ seed: 42, warmup: 24 });
  const stores: OsStores = {
    os,
    hiring: createHiringStore(),
    chat: createChatStore({ gateway: createSimulatedGateway(m), errorText: m.chat.error }),
    settings: createAgentSettingsStore(),
    missions: createMissionsStore({ m, onEvents: (events) => os.getState().record(events) }),
    tasks: createTasksStore(),
    journal: createJournalStore(),
  };
  return { stores, disconnect: connect(stores) };
}

/** Si otra pestaña guarda cambios, se releen (si no, la última en guardar pisaría a la otra). */
function listenToOtherTabs(stores: OsStores): () => void {
  const reloaders: Readonly<Record<string, () => void>> = {
    'methacity.hiring.v1': () => stores.hiring.getState().reload(),
    'methacity.chat.v1': () => stores.chat.getState().reload(),
    'methacity.agents.v1': () => stores.settings.getState().reload(),
    'methacity.missions.v1': () => stores.missions.getState().reload(),
    'methacity.tasks.v1': () => stores.tasks.getState().reload(),
    'methacity.journal.v1': () => stores.journal.getState().reload(),
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
    const { stores: created, disconnect } = createStores();
    setStores(created);
    const stopListening = listenToOtherTabs(created);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      created.os.getState().record(created.missions.getState().tick());
      created.os.getState().tick();
    }, SIMULATION_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      stopListening();
      disconnect();
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

export function useMissions<T>(selector: (s: MissionsState) => T): T | null {
  return useSlice((s) => s.missions, selector);
}

export function useTasks<T>(selector: (s: TasksStoreState) => T): T | null {
  return useSlice((s) => s.tasks, selector);
}

export function useJournal<T>(selector: (s: JournalStoreState) => T): T | null {
  return useSlice((s) => s.journal, selector);
}
