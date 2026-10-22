'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from 'zustand';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import type { LabelRegistry } from '@/features/city/overlay/labelRegistry';
import type { CityStore } from '@/features/city/state/cityStore';
import type { OsStore } from '@/os/osStore';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { CameraRig } from './CameraRig';
import { CampusWorld } from './CampusWorld';
import { LabelProjector } from './LabelProjector';
import { Lighting, LocalEnvironment } from './Lighting';

interface Props {
  readonly store: CityStore;
  readonly osStore: OsStore | null;
  readonly labels: LabelRegistry;
  readonly label: string;
  readonly onReady: () => void;
  readonly onContextLost: () => void;
}

/** Diagnóstico de solo lectura para las pruebas e2e (como `window.__campus` en preview.html). */
function Diagnostics({ store }: Readonly<{ store: CityStore }>) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    window.__methacity = {
      renderInfo: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }),
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
  }, [gl, camera, store]);
  return null;
}

interface SceneProps {
  readonly store: CityStore;
  readonly osStore: OsStore | null;
  readonly labels: LabelRegistry;
  readonly onReady: () => void;
  readonly reducedMotion: boolean;
}

function SceneContent({ store, osStore, labels, onReady, reducedMotion }: SceneProps) {
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
      <CampusWorld store={store} osStore={osStore} reducedMotion={reducedMotion} />
      <CameraRig store={store} reducedMotion={reducedMotion} />
      <LabelProjector store={store} registry={labels} />
      <Diagnostics store={store} />
    </>
  );
}

/** Lienzo WebGL de la ciudad. Se carga solo en el cliente (`next/dynamic` con ssr: false). */
export default function CampusCanvas({ store, osStore, labels, label, onReady, onContextLost }: Props) {
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
      <SceneContent store={store} osStore={osStore} labels={labels} onReady={onReady} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
