import { TasksBoard } from '@/features/tasks/TasksBoard';
import { getMessages } from '@/i18n';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.tasks} · METHACity` };

/** Módulo «Aufgaben» (Tasks de NEXORA): Kanban. */
export default function TasksPage() {
  return <TasksBoard m={getMessages()} />;
}
