import { TasksBoard } from '@/features/tasks/TasksBoard';
import { getMessages } from '@/i18n';
import { PageProjects } from '../PageProjects';
import type { SearchParams } from '../pageSnapshot';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.tasks} · METHACity` };

/** Módulo «Aufgaben» (Tasks de NEXORA): Kanban. */
export default function TasksPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <>
      <PageProjects searchParams={searchParams} />
      <TasksBoard m={getMessages()} />
    </>
  );
}
