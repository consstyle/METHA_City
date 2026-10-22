'use client';

import { useMemo } from 'react';
import { pendingCount } from './approvals';
import { isFinished } from './missions/mission';
import { useHiring, useMissions, useSim } from './OsProvider';

/**
 * Recuentos del sistema para el Leitstand y el panel de la ciudad: Freigaben pendientes (las que
 * se pueden decidir en el módulo Freigaben: misiones y contrataciones) y misiones en curso.
 * null mientras el sistema arranca.
 */
export function useCounts(): { approvals: number; missions: number } | null {
  const sim = useSim();
  const hiring = useHiring((s) => s.hiring);
  const missions = useMissions((s) => s.missions);
  return useMemo(() => {
    if (!sim || !hiring || !missions) return null;
    return {
      approvals: pendingCount(hiring, missions),
      missions: missions.filter((x) => !isFinished(x)).length,
    };
  }, [sim, hiring, missions]);
}
