import type { CityState } from '@/features/city/state/cityStore';
import { PITCH_STEP, YAW_STEP, ZOOM_STEP } from './cameraMath';

type CameraActions = Pick<CityState, 'rotateBy' | 'tiltBy' | 'zoomBy' | 'reset'>;

/** Teclas de cámara de preview.html: flechas giran/inclinan, +/− acercan, Inicio/Esc restablecen. */
export function handleCameraKey(key: string, actions: CameraActions): boolean {
  switch (key) {
    case 'ArrowLeft': actions.rotateBy(-YAW_STEP); return true;
    case 'ArrowRight': actions.rotateBy(YAW_STEP); return true;
    case 'ArrowUp': actions.tiltBy(PITCH_STEP); return true;
    case 'ArrowDown': actions.tiltBy(-PITCH_STEP); return true;
    case '+':
    case '=': actions.zoomBy(ZOOM_STEP); return true;
    case '-': actions.zoomBy(1 / ZOOM_STEP); return true;
    case 'Home':
    case 'Escape': actions.reset(); return true;
    default: return false;
  }
}
