import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { format, type Messages } from '@/i18n';
import type { ActivityEvent } from './contract';

type TaskAgentId = keyof Messages['sim']['tasks'];

/** Nombre visible de un agente: el orquestador por su nombre propio, las unidades por la suya. */
export function agentName(id: string | null, m: Messages): string {
  if (!id) return '';
  if (id === ORCHESTRATOR_AGENT) return m.agents.chief;
  return CAMPUS_UNITS.find((u) => (u.agent ?? u.id) === id)?.name ?? id;
}

/** Texto de la tarea simulada de un agente (catálogo `sim.tasks`). */
export function taskText(agentId: string, taskIndex: number | null, m: Messages): string {
  if (taskIndex === null) return '';
  const tasks = (m.sim.tasks as Readonly<Record<string, readonly string[]>>)[agentId as TaskAgentId];
  return tasks?.[taskIndex] ?? '';
}

/** Frase de la actividad en alemán, p. ej. «Werkhof beginnt: Kommissionsliste …». */
export function activityText(e: ActivityEvent, m: Messages): string {
  return format(m.activity[e.type], {
    agent: agentName(e.agentId, m),
    target: agentName(e.targetAgentId, m),
    task: taskText(e.targetAgentId && e.type === 'delegated' ? e.targetAgentId : e.agentId, e.taskIndex, m),
  });
}
