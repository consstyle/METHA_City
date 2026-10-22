'use client';

import { useSearchParams } from 'next/navigation';

/** Conserva `?szenario=` del simulador al cambiar de módulo (desaparece con el backend, B1). */
export function useScenarioQuery(): string {
  const scenario = useSearchParams().get('szenario');
  return scenario ? `?szenario=${encodeURIComponent(scenario)}` : '';
}
