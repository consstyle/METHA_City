import { createStore } from 'zustand/vanilla';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { unitById } from '@/features/city/model/hierarchy';
import { layoutSites, parseSiteId, type ProjectRef, type ProjectSite } from '@/features/city/model/projects';
import {
  CAMERA_DEFAULTS, FOCUS_ZOOM, TOP_VIEW_PITCH, clampPitch, clampZoom, focusTargetFor, sceneExtent, type CameraPose,
} from '@/features/city/scene/camera/cameraMath';

export type CityView = 'city' | 'hierarchy';
/** `flow`: Teilsysteme circulando por las calles (preview.html «Flujo TS»). */
export type CityOption = 'auto' | 'links' | 'tags' | 'day' | 'flow';

/** Pose deseada de la cámara; la escena se acerca a ella con amortiguación en cada fotograma. */
export interface CameraState extends CameraPose {
  readonly topView: boolean;
  /** Edificio u obra enfocada (id de unidad o `projekt:<id>`). */
  readonly focus: string | null;
}

export interface CityState {
  /** Edificio del campus u obra de proyecto seleccionada (id de unidad o `projekt:<id>`). */
  readonly selected: string;
  readonly view: CityView;
  readonly options: Readonly<Record<CityOption, boolean>>;
  readonly camera: CameraState;
  /** Obras de los proyectos activos alrededor de la isla (F5c). */
  readonly sites: readonly ProjectSite[];
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
  /** Coloca las obras de los proyectos; no cambia nada si la lista de proyectos es la misma. */
  setSites(projects: readonly ProjectRef[]): void;
}

const INITIAL_CAMERA: CameraState = { ...CAMERA_DEFAULTS, topView: false, focus: null };
/** Altura de enfoque de una obra (la grúa llega a ~6 m). */
const SITE_FOCUS_HEIGHT = 7;
const SITE_FOCUS_FACTOR = 0.7;

const sameProjects = (sites: readonly ProjectSite[], projects: readonly ProjectRef[]) =>
  sites.length === projects.length
  && projects.every((p) => sites.some((s) => s.projektId === p.projektId && s.projektnummer === p.projektnummer && s.projektname === p.projektname));

/** Factor de encuadre por las obras (ver sceneExtent): agranda la vista y el zoom máximo. */
export const extentOf = (state: Pick<CityState, 'sites'>) => sceneExtent(state.sites.map((s) => s.position));

/** Destino de enfoque de una unidad o de una obra; null si el id no existe. */
function focusable(id: string, sites: readonly ProjectSite[]) {
  const unit = unitById(CAMPUS_UNITS, id);
  if (unit) return { id: unit.id, target: focusTargetFor(unit) };
  const site = sites.find((s) => s.id === id);
  return site ? { id: site.id, target: focusTargetFor({ position: site.position, size: { h: SITE_FOCUS_HEIGHT } }) } : null;
}

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
      sites: [],

      select: (id) => {
        const target = focusable(id, get().sites);
        if (target) set({ selected: target.id });
      },
      setView: (view) => set({ view }),
      toggle: (option) => options({ [option]: !get().options[option] }),
      stopAuto: () => options({ auto: false }),
      zoomBy: (factor) => camera({ zoom: clampZoom(get().camera.zoom * factor, extentOf(get())) }),
      setZoom: (zoom) => camera({ zoom: clampZoom(zoom, extentOf(get())) }),
      rotateBy: (delta) => camera({ yaw: get().camera.yaw + delta }),
      tiltBy: (delta) => camera({ pitch: clampPitch(get().camera.pitch + delta) }),
      setOrbit: ({ yaw, pitch }) => camera({ yaw, pitch: clampPitch(pitch) }),
      toggleTopView: () => {
        const topView = !get().camera.topView;
        camera({ topView, pitch: topView ? TOP_VIEW_PITCH : CAMERA_DEFAULTS.pitch });
      },
      focus: (id) => {
        const target = focusable(id, get().sites);
        if (!target) return;
        set({ view: 'city' });
        options({ auto: false });
        // El encuadre crece con las obras (sceneExtent): el enfoque compensa para acercarse igual.
        // Una obra (plataforma de 11 m) se ve entera con algo menos de zoom que un edificio.
        const extent = extentOf(get());
        const zoom = FOCUS_ZOOM * extent * (parseSiteId(target.id) ? SITE_FOCUS_FACTOR : 1);
        camera({ focus: target.id, target: target.target, zoom: clampZoom(zoom, extent) });
      },
      reset: () => {
        options({ auto: false });
        set({ camera: INITIAL_CAMERA });
      },
      setSites: (projects) => {
        if (sameProjects(get().sites, projects)) return;
        const sites = layoutSites(projects);
        // Una obra seleccionada o enfocada que ya no existe: la selección vuelve a AVOR y se suelta el foco.
        const selected = focusable(get().selected, sites) ? get().selected : 'avor';
        const focus = get().camera.focus;
        set({ sites, selected });
        if (focus && !focusable(focus, sites)) camera({ focus: null });
      },
    };
  });
}

export type CityStore = ReturnType<typeof createCityStore>;
