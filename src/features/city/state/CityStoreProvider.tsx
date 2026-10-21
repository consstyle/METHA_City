'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createCityStore, type CityState, type CityStore } from './cityStore';

const CityStoreContext = createContext<CityStore | null>(null);

/** Un estado de la ciudad por página (no compartido entre peticiones del servidor). */
export function CityStoreProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [store] = useState(createCityStore);
  return <CityStoreContext.Provider value={store}>{children}</CityStoreContext.Provider>;
}

export function useCityStoreApi(): CityStore {
  const store = useContext(CityStoreContext);
  if (!store) throw new Error('useCityStoreApi debe usarse dentro de <CityStoreProvider>');
  return store;
}

export function useCity<T>(selector: (state: CityState) => T): T {
  return useStore(useCityStoreApi(), selector);
}
