import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { PROJECT_AGENT_PATTERN, specialistById } from '@/features/city/model/specialists';
import { format, type Messages } from '@/i18n';
import type { ActivityEvent } from './contract';
import type { SimAgent } from './simulation/engine';

type TaskAgentId = keyof Messages['sim']['tasks'];

/** Papel de un agente de proyecto (`pl-…` Projektleitung, `bl-…` Bauleitung) o null si no lo es. */
export function projectRole(id: string): { role: 'projektleitung' | 'bauleitung'; nr: string } | null {
  if (!PROJECT_AGENT_PATTERN.test(id)) return null;
  return { role: id.startsWith('pl-') ? 'projektleitung' : 'bauleitung', nr: id.slice(3).toUpperCase() };
}

/** Nombre visible de un agente: el orquestador por su nombre propio, unidades, especialistas y equipos de proyecto. */
export function agentName(id: string | null, m: Messages): string {
  if (!id) return '';
  if (id === ORCHESTRATOR_AGENT) return m.agents.chief;
  const role = specialistById(id);
  if (role) return m.specialists[role.id].name;
  const project = projectRole(id);
  if (project) return format(project.role === 'projektleitung' ? m.projectAgents.pl : m.projectAgents.bl, { nr: project.nr });
  return CAMPUS_UNITS.find((u) => (u.agent ?? u.id) === id)?.name ?? id;
}

/** Texto de la tarea simulada de un agente (catálogo `sim.tasks`; los de proyecto usan el de su papel). */
export function taskText(agentId: string, taskIndex: number | null, m: Messages): string {
  if (taskIndex === null) return '';
  const key = projectRole(agentId)?.role ?? agentId;
  const tasks = (m.sim.tasks as Readonly<Record<string, readonly string[]>>)[key as TaskAgentId];
  return tasks?.[taskIndex] ?? '';
}

/** Lo que hace un agente ahora: el paso de misión que lo ocupa o su tarea del motor. */
export function agentTaskText(agent: Pick<SimAgent, 'id' | 'taskIndex' | 'focus'>, m: Messages): string {
  return agent.focus ?? taskText(agent.id, agent.taskIndex, m);
}

/** Frase de la actividad en alemán, p. ej. «Werkhof beginnt: Kommissionsliste …». */
export function activityText(e: ActivityEvent, m: Messages): string {
  return format(m.activity[e.type], {
    agent: agentName(e.agentId, m),
    target: agentName(e.targetAgentId, m),
    task: e.note ?? taskText(e.targetAgentId && e.type === 'delegated' ? e.targetAgentId : e.agentId, e.taskIndex, m),
  });
}
