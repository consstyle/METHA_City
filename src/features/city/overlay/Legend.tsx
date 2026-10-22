'use client';

import { useCity } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';

/** Leyenda de rutas, ayuda de uso y brújula (esquinas inferiores de la escena). */
export function Legend({ m }: Readonly<{ m: Messages }>) {
  const links = useCity((s) => s.options.links);
  const flow = useCity((s) => s.options.flow);
  return (
    <>
      <div className="legend" aria-hidden="true">
        <div style={{ opacity: links ? 1 : 0.3 }}><i />{m.legend.hierarchy}</div>
        <div style={{ opacity: links ? 1 : 0.3 }}><i className="coord" />{m.legend.coordination}</div>
        <div style={{ opacity: flow ? 1 : 0.3 }}><i className="ts" />{m.legend.ts}</div>
      </div>
      <div className="help" aria-hidden="true">{m.legend.drag}<br />{m.legend.wheel}</div>
      <div className="compass" title={m.legend.compass} aria-hidden="true">N</div>
    </>
  );
}
