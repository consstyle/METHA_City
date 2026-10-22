import 'server-only';
import { ProjectsSync } from '@/features/projects/ProjectsSync';
import { loadPageSnapshot, type SearchParams } from './pageSnapshot';

/**
 * Para los módulos que no muestran datos de MethaDesk pero sí agentes (Agenten, Aufgaben…): carga
 * los proyectos activos para que existan sus equipos (Projektleitung y Bauleitung, F5c).
 */
export async function PageProjects({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const { result } = await loadPageSnapshot(searchParams);
  return <ProjectsSync result={result} />;
}
