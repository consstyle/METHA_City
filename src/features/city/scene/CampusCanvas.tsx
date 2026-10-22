'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from 'zustand';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import type { FlowStore, FlowTagRegistry } from '@/features/city/flow/flowStore';

/** Flujo de Teilsysteme: estado, etiquetas sobre los camiones y su texto («TS 1203»). */
export interface FlowProps {
  readonly store: FlowStore;
  readonly tags: FlowTagRegistry;
  readonly tagLabel: (nr: number) => string;
}
import type { LabelRegistry } from '@/features/city/overlay/labelRegistry';
import type { CityStore } from '@/features/city/state/cityStore';
import type { HiringStore } from '@/os/hiringStore';
import type { OsStore } from '@/os/osStore';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { CameraRig } from './CameraRig';
import { CampusWorld } from './CampusWorld';
import { LabelProjector } from './LabelProjector';
import { Lighting, LocalEnvironment } from './Lighting';

interface Props {
  readonly store: CityStore;
  readonly osStore: OsStore | null;
  readonly hiringStore: HiringStore | null;
  /** Flujo de Teilsysteme: movimientos para el panel y etiquetas sobre los camiones. */
  readonly flow: FlowProps;
  readonly labels: LabelRegistry;
  readonly label: string;
  readonly onReady: () => void;
  readonly onContextLost: () => void;
}

/** Diagnóstico de solo lectura para las pruebas e2e (como `window.__campus` en preview.html). */
function Diagnostics({ store }: Readonly<{ store: CityStore }>) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    window.__methacity = {
      renderInfo: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }),
      /** Pabellones en la escena: papel y si espera Freigabe. */
      pavilions: () =>
        (scene.getObjectByName('pavilions')?.children ?? []).map((g) => ({ role: String(g.userData.role), pending: Boolean(g.userData.pending) })),
      getState: () => {
        const { selected, view, options, camera: pose } = store.getState();
        return { selected, view, options, camera: pose };
      },
      /** Centro de un edificio en coordenadas de la ventana (para hacer clic en él). */
      unitScreenPosition: (id: string) => {
        const unit = CAMPUS_UNITS.find((u) => u.id === id);
        if (!unit) return null;
        const rect = gl.domElement.getBoundingClientRect();
        const p = new THREE.Vector3(unit.position.x, unit.size.h * 0.5, unit.position.z).project(camera);
        return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
      },
    };
    return () => {
      delete window.__methacity;
    };
  }, [gl, camera, scene, store]);
  return null;
}

interface SceneProps {
  readonly store: CityStore;
  readonly osStore: OsStore | null;
  readonly hiringStore: HiringStore | null;
  readonly flow: FlowProps;
  readonly labels: LabelRegistry;
  readonly onReady: () => void;
  readonly reducedMotion: boolean;
}

function SceneContent({ store, osStore, hiringStore, flow, labels, onReady, reducedMotion }: SceneProps) {
  const day = useStore(store, (s) => s.options.day);
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);

  // <html> sobrevive a la navegación entre módulos: la marca se retira al desmontar la escena.
  useEffect(() => () => {
    delete document.documentElement.dataset.cityReady;
  }, []);

  // Las sombras son estáticas: se calculan en los primeros fotogramas y al cambiar la luz.
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) {
      gl.shadowMap.autoUpdate = false;
      document.documentElement.dataset.cityReady = 'true';
      onReady();
    }
  });

  return (
    <>
      <LocalEnvironment />
      <Lighting day={day} />
      <CampusWorld store={store} osStore={osStore} hiringStore={hiringStore} flow={flow} reducedMotion={reducedMotion} />
      <CameraRig store={store} reducedMotion={reducedMotion} />
      <LabelProjector store={store} registry={labels} />
      <Diagnostics store={store} />
    </>
  );
}

/** Lienzo WebGL de la ciudad. Se carga solo en el cliente (`next/dynamic` con ssr: false). */
export default function CampusCanvas({ store, osStore, hiringStore, flow, labels, label, onReady, onContextLost }: Props) {
  const reducedMotion = useReducedMotion();
  // En la vista Hierarchie la escena queda oculta: se detiene el bucle de dibujo.
  const paused = useStore(store, (s) => s.view !== 'city');
  return (
    <Canvas
      className="scene-canvas"
      orthographic
      shadows="soft"
      dpr={[1, 1.75]}
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ manual: true, near: 0.1, far: 180, position: [0, 40, 60] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
        gl.setClearColor(0x000000, 0);
        const el = gl.domElement;
        el.tabIndex = 0;
        el.setAttribute('aria-label', label);
        el.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
    >
      <SceneContent store={store} osStore={osStore} hiringStore={hiringStore} flow={flow} labels={labels} onReady={onReady} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
