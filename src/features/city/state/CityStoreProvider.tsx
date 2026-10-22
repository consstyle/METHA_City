'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createFlowStore, type FlowState, type FlowStore } from '@/features/city/flow/flowStore';
import { createCityStore, type CityState, type CityStore } from './cityStore';

interface CityStores {
  readonly city: CityStore;
  readonly flow: FlowStore;
}

const CityStoreContext = createContext<CityStores | null>(null);

/** Un estado de la ciudad por página (no compartido entre peticiones del servidor). */
export function CityStoreProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [stores] = useState<CityStores>(() => ({ city: createCityStore(), flow: createFlowStore() }));
  return <CityStoreContext.Provider value={stores}>{children}</CityStoreContext.Provider>;
}

function useStores(): CityStores {
  const stores = useContext(CityStoreContext);
  if (!stores) throw new Error('useCityStoreApi debe usarse dentro de <CityStoreProvider>');
  return stores;
}

export function useCityStoreApi(): CityStore {
  return useStores().city;
}

export function useCity<T>(selector: (state: CityState) => T): T {
  return useStore(useCityStoreApi(), selector);
}

export function useFlowStoreApi(): FlowStore {
  return useStores().flow;
}

export function useFlow<T>(selector: (state: FlowState) => T): T {
  return useStore(useFlowStoreApi(), selector);
}
