'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { advanceCarrier, createCarrier, type Carrier } from '@/features/city/flow/carrier';
import type { FlowStore, FlowTagRegistry } from '@/features/city/flow/flowStore';
import { FLOW_PAIRS, MAX_ACTIVE, SITE_ORIGIN, type TsEvent } from '@/features/city/flow/tsFlow';
import type { ProjectSite } from '@/features/city/model/projects';
import type { CityStore } from '@/features/city/state/cityStore';
import type { Materials } from './builder/materials';
import { routeBetween, routeToSite, type Point2 } from './builder/roads';
import { bySlot, KIND_COLOR, writeRings, writeTags, writeTrucks } from './flowFrame';
import { createFlowMeshes } from './flowMeshes';

interface Props {
  readonly store: CityStore;
  readonly flowStore: FlowStore;
  readonly tags: FlowTagRegistry;
  readonly tagLabel: (nr: number) => string;
  readonly materials: Materials;
}

/** Diagnóstico de solo lectura para las pruebas e2e. */
declare global {
  interface Window {
    __methacityFlow?: { active(): { nr: number; kind: string; phase: string }[]; emitted(): number };
  }
}

const unitById = (id: string) => CAMPUS_UNITS.find((u) => u.id === id);
/** Paso máximo (s) del movimiento de los camiones y del reloj de salidas por fotograma. */
const MAX_MOVE_STEP = 0.2;
const MAX_CLOCK_STEP = 0.5;

/**
 * Rutas de todos los movimientos del ciclo, calculadas una vez por lista de obras (no dentro del
 * bucle de dibujo). Los TS terminados salen de AVOR hacia la obra de su proyecto.
 */
function precomputeRoutes(sites: readonly ProjectSite[]): ReadonlyMap<string, readonly Point2[]> {
  const routes = new Map<string, readonly Point2[]>();
  for (const [from, to] of FLOW_PAIRS) {
    const a = unitById(from);
    const b = unitById(to);
    const path = a && b ? routeBetween(a, b) : null;
    if (path) routes.set(`${from}>${to}`, path);
  }
  const origin = unitById(SITE_ORIGIN);
  for (const site of sites) {
    const path = origin ? routeToSite(origin, site) : null;
    if (path) routes.set(`${SITE_ORIGIN}>${site.id}`, path);
  }
  return routes;
}

/**
 * Teilsysteme circulando por las calles (preview.html «Flujo de Teilsysteme»): camiones con la
 * caja del color del tipo de movimiento, etiqueta «TS 1203» y un anillo naranja al llegar.
 * La simulación vive en `flowStore` (sobrevive a cambiar de módulo); aquí solo los camiones en la calle.
 */
export function TsFlow({ store, flowStore, tags, tagLabel, materials }: Props) {
  const meshes = useMemo(() => createFlowMeshes(materials), [materials]);
  const sites = useStore(store, (s) => s.sites);
  const routes = useMemo(() => precomputeRoutes(sites), [sites]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const carriers = useRef<Carrier[]>([]);
  const wait = useRef(0.6);
  const elapsed = useRef(0);
  const emitted = useRef(0);
  const arrivals = useRef<number[]>(CAMPUS_UNITS.map(() => 0));
  const ringsAlive = useRef(false);

  useEffect(() => {
    // Mallas nuevas (otra visita o la ciudad reconstruida al cambiar las obras): se retiran los
    // camiones en curso y sus TS quedan libres, así nunca hay dos camiones con el mismo TS.
    carriers.current = [];
    flowStore.getState().remount();
    window.__methacityFlow = {
      active: () => carriers.current.map((c) => ({ nr: c.event.nr, kind: c.event.kind, phase: c.phase })),
      emitted: () => emitted.current,
    };
    return () => {
      delete window.__methacityFlow;
      meshes.dispose();
    };
  }, [meshes, flowStore]);

  /** Saca el siguiente TS a la calle si hay hueco (sin ruta, el TS se libera en lugar de quedar bloqueado). */
  const launch = (): void => {
    const used = new Set(carriers.current.map((c) => c.slot));
    const slot = Array.from({ length: MAX_ACTIVE }, (_, i) => i).find((i) => !used.has(i));
    if (slot === undefined) return;
    const event: TsEvent | null = flowStore.getState().next(elapsed.current, Math.random, siteIds);
    elapsed.current = 0;
    if (!event) return;
    const path = routes.get(`${event.from}>${event.to}`);
    if (!path) {
      flowStore.getState().arrived(event.nr, 0); // sin ruta: el TS no queda bloqueado
      return;
    }
    carriers.current = [...carriers.current, createCarrier(slot, event, path, 3.4 + Math.random() * 0.5)];
    meshes.cargo.setColorAt(slot, KIND_COLOR[event.kind]);
    if (meshes.cargo.instanceColor) meshes.cargo.instanceColor.needsUpdate = true;
    emitted.current += 1;
    flowStore.getState().record(event);
  };

  useFrame((_, delta) => {
    const { options, view } = store.getState();
    const on = options.flow && view === 'city';
    meshes.group.visible = on;
    // Movimiento con pasos acotados; el reloj de salidas sigue el tiempo real aunque haya pocos
    // fotogramas por segundo (si no, con 2 fps los camiones saldrían siete veces más despacio).
    const dt = Math.min(MAX_MOVE_STEP, delta);
    const tick = Math.min(MAX_CLOCK_STEP, delta);
    elapsed.current += tick * 1000;
    if (on) {
      wait.current -= tick;
      if (wait.current <= 0) {
        launch();
        wait.current = 2.1 + Math.random() * 1.7;
      }
    }
    carriers.current = carriers.current.flatMap((c) => {
      const moved = advanceCarrier(c, dt);
      if (c.phase === 'drive' && moved.phase === 'arrive') {
        const i = CAMPUS_UNITS.findIndex((u) => u.id === c.event.to);
        if (i >= 0) arrivals.current[i] = 1;
        ringsAlive.current = true;
        flowStore.getState().arrived(c.event.nr, elapsed.current);
        elapsed.current = 0;
      }
      return moved.phase === 'done' ? [] : [moved];
    });
    const slots = bySlot(carriers.current);
    writeTrucks(meshes, slots);
    if (ringsAlive.current) ringsAlive.current = writeRings(meshes, arrivals.current, dt);
    writeTags(tags, slots, on, { camera, width: size.width, height: size.height, label: tagLabel });
  });

  return <primitive object={meshes.group} />;
}
