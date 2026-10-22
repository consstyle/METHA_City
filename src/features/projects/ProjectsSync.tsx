'use client';

import { useEffect } from 'react';
import type { SnapshotResult } from '@/data/load';
import { projectTeamIds } from '@/features/city/model/projects';
import { useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import { useOsStoreApi } from '@/os/OsProvider';

/**
 * Lleva los proyectos activos del snapshot de MethaDesk a la ciudad (una obra por proyecto) y al
 * sistema de agentes (Projektleitung y Bauleitung por proyecto). F5c, D26–D28. No dibuja nada.
 * Sin datos (error de carga) no se toca nada: se conservan las obras de la última carga buena.
 */
export function ProjectsSync({ result }: Readonly<{ result: SnapshotResult }>) {
  const city = useCityStoreApi();
  const os = useOsStoreApi();
  const projects = result.ok ? result.snapshot.projects : null;

  useEffect(() => {
    if (!projects) return;
    city.getState().setSites(projects);
    const ids = projectTeamIds(projects);
    os?.getState().syncProjects(projects.flatMap((p) => {
      const agents = ids.get(p.projektId);
      return agents ? [{ projektId: p.projektId, agents }] : [];
    }));
  }, [projects, city, os]);

  return null;
}
