'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { DISTRICT_IDS } from '@/features/city/model/types';
import { CameraTools } from '@/features/city/overlay/CameraTools';
import { CityLabels } from '@/features/city/overlay/CityLabels';
import { HierarchyView } from '@/features/city/overlay/HierarchyView';
import { createLabelRegistry } from '@/features/city/overlay/labelRegistry';
import { Legend } from '@/features/city/overlay/Legend';
import { Toolbar } from '@/features/city/overlay/Toolbar';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';
import { hasWebGL } from '@/lib/webgl';
import { useHiringStoreApi, useOsStoreApi } from '@/os/OsProvider';

const CampusCanvas = dynamic(() => import('@/features/city/scene/CampusCanvas'), { ssr: false });

type Status = 'loading' | 'ready' | 'no-webgl' | 'context-lost';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Escena 3D con sus controles superpuestos (estructura de #stage en preview.html). */
export function CityStage({ m }: Readonly<{ m: Messages }>) {
  const store = useCityStoreApi();
  const osStore = useOsStoreApi();
  const hiringStore = useHiringStoreApi();
  const view = useCity((s) => s.view);
  const [labels] = useState(createLabelRegistry);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!hasWebGL()) setStatus('no-webgl');
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      store.getState().reset();
      store.getState().setView('city');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const message = { loading: m.scene.loading, 'no-webgl': m.scene.noWebgl, 'context-lost': m.scene.contextLost, ready: '' }[status];
  const showCity = view === 'city';

  return (
    <section id="ciudad" className="stage" aria-label={m.scene.label}>
      {status !== 'no-webgl' && (
        <CampusCanvas
          store={store}
          osStore={osStore}
          hiringStore={hiringStore}
          labels={labels}
          label={m.scene.canvasLabel}
          onReady={() => setStatus((s) => (s === 'loading' ? 'ready' : s))}
          onContextLost={() => setStatus('context-lost')}
        />
      )}
      {status === 'ready' && <CityLabels m={m} registry={labels} />}
      {showCity && (
        <>
          <div className="scene-title">
            <div className="eyebrow">{m.scene.eyebrow}</div>
            <h1>
              {m.scene.titleLine1}
              <br />
              {m.scene.titleLine2}
            </h1>
            <p>
              {m.scene.subtitle} <span>{m.scene.subtitleStrong}</span>
            </p>
          </div>
          <div className="scene-index">
            <strong>{pad2(DISTRICT_IDS.length)} / {pad2(CAMPUS_UNITS.length)}</strong>
            <br />
            {m.scene.indexLabel}
          </div>
        </>
      )}
      {status === 'ready' && showCity && (
        <>
          <CameraTools m={m} />
          <Legend m={m} />
          <Toolbar m={m} />
        </>
      )}
      {view === 'hierarchy' && <HierarchyView m={m} />}
      {status !== 'ready' && showCity && (
        <div className={`scene-status${status === 'loading' ? ' busy' : ''}`} role="status">
          {message}
        </div>
      )}
    </section>
  );
}
