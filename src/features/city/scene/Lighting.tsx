'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Luces de preview.html para «Abendlicht» (atardecer) y «Tageslicht». */
export const LIGHTING = {
  sunset: { hemi: 2.1, sun: 3.1, fill: 2.2, sunColor: 0xffe1c1, exposure: 1.02 },
  day: { hemi: 3.1, sun: 4.5, fill: 2.7, sunColor: 0xfff0dc, exposure: 1.15 },
} as const;

export function Lighting({ day }: Readonly<{ day: boolean }>) {
  const gl = useThree((s) => s.gl);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const l = day ? LIGHTING.day : LIGHTING.sunset;
    if (hemi.current) hemi.current.intensity = l.hemi;
    if (sun.current) {
      sun.current.intensity = l.sun;
      sun.current.color.setHex(l.sunColor);
    }
    if (fill.current) fill.current.intensity = l.fill;
    gl.toneMappingExposure = l.exposure;
    gl.shadowMap.needsUpdate = true;
  }, [day, gl]);

  return (
    <>
      <hemisphereLight ref={hemi} args={[0xc3d9e6, 0x32251d, LIGHTING.sunset.hemi]} />
      <directionalLight
        ref={sun}
        position={[-22, 35, 18]}
        intensity={LIGHTING.sunset.sun}
        color={LIGHTING.sunset.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-normalBias={0.035}
        shadow-bias={-0.00015}
      />
      <directionalLight ref={fill} position={[15, 18, -25]} intensity={LIGHTING.sunset.fill} color={0xb8d5e1} />
    </>
  );
}

/** Entorno de reflejos generado localmente (sin descargar HDR), como en preview.html. */
export function LocalEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x59636a);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x272d32 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -12;
    env.add(floor);
    const panels: [number, number, number, number, number, number][] = [
      [0, 25, 0, 45, 18, 0xe2e8e8], [-25, 10, 0, 12, 40, 0xaebcc4], [25, 12, -15, 16, 30, 0x787b7c],
    ];
    panels.forEach(([x, y, z, w, h, c]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    });
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(env, 0.08);
    scene.environment = target.texture;
    pmrem.dispose();
    env.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  return null;
}
