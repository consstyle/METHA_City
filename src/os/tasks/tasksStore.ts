import { createStore } from 'zustand/vanilla';
import { uniqueSuffix } from '@/lib/ids';
import { createJsonStorage, type KeyValueStore } from '@/lib/storage';
import { createTask, moveTask, removeTask, TasksStateSchema, type TaskColumn, type TasksState } from './tasks';

export interface TasksStoreState {
  readonly board: TasksState;
  add(title: string, agentId: string | null): string | null;
  move(id: string, status: TaskColumn): void;
  remove(id: string): void;
  reload(): void;
}

interface Options {
  readonly now?: () => Date;
  readonly getStore?: () => KeyValueStore | null;
}

/** Tareas manuales del tablero Aufgaben (D20), persistidas en el navegador (D15). */
export function createTasksStore({ now = () => new Date(), getStore }: Options = {}) {
  const storage = createJsonStorage('methacity.tasks', 1, TasksStateSchema, getStore);
  return createStore<TasksStoreState>()((set, get) => {
    /** Cada acción parte de lo último guardado (quizá por otra pestaña) para no pisarlo. */
    const apply = (fn: (board: TasksState) => TasksState) => {
      const board = fn(storage.load() ?? get().board);
      set({ board });
      storage.save(board);
    };
    return {
      board: storage.load() ?? { tasks: [] },
      add: (title, agentId) => {
        if (!title.trim()) return null;
        const at = now();
        const id = `t-${at.getTime().toString(36)}-${uniqueSuffix()}`;
        apply((board) => createTask(board, { title, agentId }, at, id));
        return id;
      },
      move: (id, status) => apply((board) => moveTask(board, id, status, now())),
      remove: (id) => apply((board) => removeTask(board, id)),
      reload: () => set({ board: storage.load() ?? { tasks: [] } }),
    };
  });
}

export type TasksStore = ReturnType<typeof createTasksStore>;
