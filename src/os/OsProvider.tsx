'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createOsStore, SIMULATION_INTERVAL_MS, type OsStore } from './osStore';
import type { SimState } from './simulation/engine';

const OsStoreContext = createContext<OsStore | null>(null);

/** Almacén vacío para poder llamar a useStore sin condiciones mientras el sistema aún no existe. */
const EMPTY_STORE = createOsStore({ seed: 0, now: () => new Date(0) });

/**
 * Crea el sistema de agentes solo en el navegador (tras montar): así el HTML del servidor y el
 * primer render del cliente coinciden y no hay errores de hidratación con horas o estados.
 */
export function OsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [store, setStore] = useState<OsStore | null>(null);

  useEffect(() => {
    const created = createOsStore({ seed: 42, warmup: 24 });
    setStore(created);
    const timer = window.setInterval(() => {
      if (!document.hidden) created.getState().tick();
    }, SIMULATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <OsStoreContext.Provider value={store}>{children}</OsStoreContext.Provider>;
}

export function useOsStoreApi(): OsStore | null {
  return useContext(OsStoreContext);
}

/**
 * Estado actual de la simulación, o null en el servidor y en el primer render.
 * Se devuelve el objeto completo (referencia estable por paso) y se deriva en el componente.
 */
export function useSim(): SimState | null {
  const store = useOsStoreApi();
  const sim = useStore(store ?? EMPTY_STORE, (s) => s.sim);
  return store ? sim : null;
}
