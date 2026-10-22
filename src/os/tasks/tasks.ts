import { z } from 'zod';
import type { Mission, MissionStep } from '../missions/contract';

/** Aufgaben (F5, D20): tareas manuales persistidas + pasos de misión derivados (de solo lectura). */

export const TASK_COLUMNS = ['offen', 'in-arbeit', 'wartet', 'erledigt'] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];
export const TASK_LIMIT = 200;
export const TITLE_MAX = 200;
/** Misiones (las más recientes) cuyos pasos se ven en el tablero. */
export const BOARD_MISSIONS = 5;

const isoInstant = z.string().datetime({ offset: true });
export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(TITLE_MAX),
  agentId: z.string().min(1).nullable(),
  status: z.enum(TASK_COLUMNS),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});
export type Task = z.infer<typeof TaskSchema>;
export const TasksStateSchema = z.object({ tasks: z.array(TaskSchema).max(TASK_LIMIT) });
export type TasksState = z.infer<typeof TasksStateSchema>;

export interface BoardCard {
  readonly id: string;
  readonly title: string;
  readonly agentId: string | null;
  readonly status: TaskColumn;
  /** Tarjeta de un paso de misión: sigue a la misión y no se mueve a mano. */
  readonly missionId: string | null;
  readonly missionTitle: string | null;
}

export function createTask(state: TasksState, input: { title: string; agentId: string | null }, now: Date, id: string): TasksState {
  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error('task title required');
  const at = now.toISOString();
  const task: Task = { id, title, agentId: input.agentId, status: 'offen', createdAt: at, updatedAt: at };
  return { tasks: [task, ...state.tasks].slice(0, TASK_LIMIT) };
}

export const moveTask = (state: TasksState, id: string, status: TaskColumn, now: Date): TasksState => ({
  tasks: state.tasks.map((t) => (t.id === id && t.status !== status ? { ...t, status, updatedAt: now.toISOString() } : t)),
});

export const removeTask = (state: TasksState, id: string): TasksState => ({ tasks: state.tasks.filter((t) => t.id !== id) });

/** Columna vecina para mover con el teclado (null en los extremos). */
export function neighbour(status: TaskColumn, direction: -1 | 1): TaskColumn | null {
  return TASK_COLUMNS[TASK_COLUMNS.indexOf(status) + direction] ?? null;
}

function stepColumn(mission: Mission, step: MissionStep, isLast: boolean): TaskColumn | null {
  if (step.status === 'done') return mission.status === 'awaiting-result' && isLast ? 'wartet' : 'erledigt';
  if (step.status === 'working') return 'in-arbeit';
  if (mission.status === 'awaiting-plan') return 'wartet';
  return mission.status === 'running' ? 'offen' : null;
}

export function missionCards(missions: readonly Mission[]): BoardCard[] {
  return [...missions]
    .filter((x) => x.status !== 'rejected' && x.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, BOARD_MISSIONS)
    .flatMap((mission) =>
      mission.steps.flatMap((step, i) => {
        const status = stepColumn(mission, step, i === mission.steps.length - 1);
        return status
          ? [{ id: `${mission.id}:${step.id}`, title: step.text, agentId: step.agentId, status, missionId: mission.id, missionTitle: mission.objective }]
          : [];
      }),
    );
}

export function board(state: TasksState, missions: readonly Mission[]): Record<TaskColumn, BoardCard[]> {
  const manual: BoardCard[] = state.tasks.map((t) => ({ id: t.id, title: t.title, agentId: t.agentId, status: t.status, missionId: null, missionTitle: null }));
  const cards = [...manual, ...missionCards(missions)];
  return Object.fromEntries(TASK_COLUMNS.map((c) => [c, cards.filter((x) => x.status === c)])) as Record<TaskColumn, BoardCard[]>;
}
