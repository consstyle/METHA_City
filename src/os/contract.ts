import { z } from 'zod';
import { UNIT_IDS } from '@/features/city/model/types';

/**
 * Contrato del sistema operativo de agentes (estado de agentes, actividad, salud). Lo produce el
 * motor de simulación en el MVP y la pasarela de Hermes en B4 (PLAN-DESARROLLO.md §4.2).
 */

const isoInstant = z.string().datetime({ offset: true });
const index = z.number().int().nonnegative();

export const AGENT_STATES = ['offline', 'idle', 'working', 'waiting'] as const;
export const AgentStateKindSchema = z.enum(AGENT_STATES);
export type AgentStateKind = z.infer<typeof AgentStateKindSchema>;

export const OsAgentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['orchestrator', 'unit', 'specialist']),
  unitId: z.enum(UNIT_IDS).nullable(),
  state: AgentStateKindSchema,
  /** Índice de la tarea en el catálogo de textos del agente (i18n `sim.tasks`). */
  taskIndex: index.nullable(),
  lastActiveAt: isoInstant.nullable(),
});
export type OsAgent = z.infer<typeof OsAgentSchema>;

export const ACTIVITY_TYPES = ['started', 'delegated', 'completed', 'approval', 'approved'] as const;
export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  tick: index,
  at: isoInstant,
  type: z.enum(ACTIVITY_TYPES),
  agentId: z.string().min(1),
  targetAgentId: z.string().nullable(),
  taskIndex: index.nullable(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const SERVICE_IDS = ['web', 'methadesk', 'hermes', 'database'] as const;
export const ServiceStatusSchema = z.enum(['ok', 'simulated', 'offline', 'error']);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const HealthSchema = z.object({
  services: z.array(z.object({ id: z.enum(SERVICE_IDS), status: ServiceStatusSchema })),
});
export type Health = z.infer<typeof HealthSchema>;

export const OsSnapshotSchema = z.object({
  source: z.enum(['simulation', 'live']),
  generatedAt: isoInstant,
  agents: z.array(OsAgentSchema),
  activity: z.array(ActivityEventSchema),
  counts: z.object({ tasksOpen: index, approvalsPending: index, missionsRunning: index }),
  health: HealthSchema,
});
export type OsSnapshot = z.infer<typeof OsSnapshotSchema>;
