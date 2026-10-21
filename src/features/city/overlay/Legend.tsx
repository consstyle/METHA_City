'use client';

import { useCity } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';

/** Leyenda de rutas, ayuda de uso y brújula (esquinas inferiores de la escena). */
export function Legend({ m }: Readonly<{ m: Messages }>) {
  const links = useCity((s) => s.options.links);
  return (
    <>
      <div className="legend" aria-hidden="true" style={{ opacity: links ? 1 : 0.3 }}>
        <div><i />{m.legend.hierarchy}</div>
        <div><i className="coord" />{m.legend.coordination}</div>
      </div>
      <div className="help" aria-hidden="true">{m.legend.drag}<br />{m.legend.wheel}</div>
      <div className="compass" title={m.legend.compass} aria-hidden="true">N</div>
    </>
  );
}
