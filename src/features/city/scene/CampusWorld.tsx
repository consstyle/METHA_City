'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import type { CityStore } from '@/features/city/state/cityStore';
import type { OsStore } from '@/os/osStore';
import { AgentBeacons } from './AgentBeacons';
import { buildCampus } from './builder/campus';
import { dotProgress } from './builder/links';
import { applyDaylight } from './builder/materials';

interface Props {
  readonly store: CityStore;
  readonly osStore: OsStore | null;
  readonly reducedMotion: boolean;
}

const CLICK_TOLERANCE_PX = 4;
/** Velocidad de los puntos de las rutas y del tráfico (preview.html: t · 0,00007 por ms). */
const CLOCK_SPEED = 0.07;

const pickId = (e: ThreeEvent<PointerEvent | MouseEvent>): string | undefined =>
  e.intersections.find((i) => typeof i.object.userData.id === 'string')?.object.userData.id as string | undefined;

/** Ciudad construida una vez; React solo gestiona selección, rutas, luz y animaciones. */
export function CampusWorld({ store, osStore, reducedMotion }: Props) {
  const campus = useMemo(() => buildCampus(CAMPUS_UNITS, deriveRelations(CAMPUS_UNITS)), []);
  const gl = useThree((s) => s.gl);
  const hovered = useRef<string | null>(null);

  useEffect(() => () => campus.dispose(), [campus]);

  useEffect(() => {
    const apply = () => {
      const { selected, options } = store.getState();
      campus.rings.forEach((ring, id) => { ring.visible = id === selected; });
      campus.routes.group.visible = options.links;
      applyDaylight(campus.materials, options.day);
    };
    apply();
    return store.subscribe(apply);
  }, [campus, store]);

  useFrame((state) => {
    const clock = reducedMotion ? 0 : state.clock.elapsedTime * CLOCK_SPEED;
    campus.routes.animations.forEach((a, k) =>
      a.dots.forEach((dot, j) => {
        dot.position.copy(a.curve.getPoint(dotProgress(clock, j, a.dots.length, k, a.relation.kind === 'coordination')));
      }),
    );
    campus.cars.forEach((car, i) => {
      const f = (clock * 0.28 + i * 0.33) % 1;
      const p = campus.ringPath.getPoint(f);
      const v = campus.ringPath.getTangent(f);
      car.position.set(p.x, 0.14, p.z);
      car.rotation.y = Math.atan2(v.x, v.z);
    });
  });

  const setCursor = (id: string | null) => {
    hovered.current = id;
    gl.domElement.classList.toggle('pointing', id !== null);
  };

  return (
    <>
      <primitive object={campus.root} />
      <AgentBeacons osStore={osStore} campus={campus} reducedMotion={reducedMotion} />
      <primitive
        object={campus.pickables}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => setCursor(pickId(e) ?? null)}
        onPointerOut={() => setCursor(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_TOLERANCE_PX) return;
          const id = pickId(e);
          if (id) {
            e.stopPropagation();
            store.getState().select(id);
          }
        }}
      />
    </>
  );
}
