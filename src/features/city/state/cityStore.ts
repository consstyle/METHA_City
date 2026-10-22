import { createStore } from 'zustand/vanilla';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitById } from '@/features/city/model/hierarchy';
import type { UnitId } from '@/features/city/model/types';
import {
  CAMERA_DEFAULTS, FOCUS_ZOOM, TOP_VIEW_PITCH, clampPitch, clampZoom, focusTargetFor, type CameraPose,
} from '@/features/city/scene/camera/cameraMath';

export type CityView = 'city' | 'hierarchy';
/** `flow`: Teilsysteme circulando por las calles (preview.html «Flujo TS»). */
export type CityOption = 'auto' | 'links' | 'tags' | 'day' | 'flow';

/** Pose deseada de la cámara; la escena se acerca a ella con amortiguación en cada fotograma. */
export interface CameraState extends CameraPose {
  readonly topView: boolean;
  readonly focus: UnitId | null;
}

export interface CityState {
  readonly selected: UnitId;
  readonly view: CityView;
  readonly options: Readonly<Record<CityOption, boolean>>;
  readonly camera: CameraState;
  select(id: string): void;
  setView(view: CityView): void;
  toggle(option: CityOption): void;
  stopAuto(): void;
  zoomBy(factor: number): void;
  setZoom(zoom: number): void;
  rotateBy(delta: number): void;
  tiltBy(delta: number): void;
  setOrbit(orbit: { yaw: number; pitch: number }): void;
  toggleTopView(): void;
  focus(id: string): void;
  reset(): void;
}

const INITIAL_CAMERA: CameraState = { ...CAMERA_DEFAULTS, topView: false, focus: null };

/** Estado de la interfaz de la ciudad (selección, vista, opciones y cámara), como en preview.html. */
export function createCityStore() {
  return createStore<CityState>()((set, get) => {
    const camera = (patch: Partial<CameraState>) => set({ camera: { ...get().camera, ...patch } });
    const options = (patch: Partial<Record<CityOption, boolean>>) => set({ options: { ...get().options, ...patch } });

    return {
      selected: 'avor',
      view: 'city',
      options: { auto: false, links: true, tags: true, day: false, flow: true },
      camera: INITIAL_CAMERA,

      select: (id) => {
        const unit = unitById(CAMPUS_UNITS, id);
        if (unit) set({ selected: unit.id });
      },
      setView: (view) => set({ view }),
      toggle: (option) => options({ [option]: !get().options[option] }),
      stopAuto: () => options({ auto: false }),
      zoomBy: (factor) => camera({ zoom: clampZoom(get().camera.zoom * factor) }),
      setZoom: (zoom) => camera({ zoom: clampZoom(zoom) }),
      rotateBy: (delta) => camera({ yaw: get().camera.yaw + delta }),
      tiltBy: (delta) => camera({ pitch: clampPitch(get().camera.pitch + delta) }),
      setOrbit: ({ yaw, pitch }) => camera({ yaw, pitch: clampPitch(pitch) }),
      toggleTopView: () => {
        const topView = !get().camera.topView;
        camera({ topView, pitch: topView ? TOP_VIEW_PITCH : CAMERA_DEFAULTS.pitch });
      },
      focus: (id) => {
        const unit = unitById(CAMPUS_UNITS, id);
        if (!unit) return;
        set({ view: 'city' });
        options({ auto: false });
        camera({ focus: unit.id, target: focusTargetFor(unit), zoom: FOCUS_ZOOM });
      },
      reset: () => {
        options({ auto: false });
        set({ camera: INITIAL_CAMERA });
      },
    };
  });
}

export type CityStore = ReturnType<typeof createCityStore>;
