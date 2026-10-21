'use client';

import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { ZOOM_STEP } from '@/features/city/scene/camera/cameraMath';
import type { Messages } from '@/i18n';

/** Zoom, restablecer y vista aérea (columna derecha de la escena en preview.html). */
export function CameraTools({ m }: Readonly<{ m: Messages }>) {
  const store = useCityStoreApi();
  const topView = useCity((s) => s.camera.topView);
  return (
    <div className="camera-tools" role="group" aria-label={m.camera.label}>
      <button type="button" className="icon" aria-label={m.camera.zoomIn} title={m.camera.zoomIn} onClick={() => store.getState().zoomBy(ZOOM_STEP)}>+</button>
      <button type="button" className="icon" aria-label={m.camera.zoomOut} title={m.camera.zoomOut} onClick={() => store.getState().zoomBy(1 / ZOOM_STEP)}>−</button>
      <button type="button" className="icon" aria-label={m.camera.reset} title={m.camera.reset} onClick={() => store.getState().reset()}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8 M4 4v6h6" /></svg>
      </button>
      <button type="button" className="icon" aria-label={m.camera.topView} title={m.camera.topView} aria-pressed={topView} onClick={() => store.getState().toggleTopView()}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 9-9 9-9-9Z M12 7v10 M7 12h10" /></svg>
      </button>
    </div>
  );
}
