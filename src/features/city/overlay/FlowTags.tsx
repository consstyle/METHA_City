'use client';

import { MAX_ACTIVE } from '@/features/city/flow/tsFlow';
import type { FlowTagRegistry } from '@/features/city/flow/flowStore';

/**
 * Etiquetas «TS 1203» sobre los camiones: un hueco por camión posible. La escena (TsFlow) las
 * coloca y rellena en cada fotograma. Decorativas: el panel «TS in Bewegung» da la misma
 * información de forma accesible.
 */
export function FlowTags({ registry }: Readonly<{ registry: FlowTagRegistry }>) {
  return (
    <div className="tstags-layer" aria-hidden="true">
      {Array.from({ length: MAX_ACTIVE }, (_, slot) => (
        <div
          key={slot}
          className="tstag"
          style={{ display: 'none' }}
          ref={(el) => {
            registry.tags[slot] = el;
          }}
        />
      ))}
    </div>
  );
}
