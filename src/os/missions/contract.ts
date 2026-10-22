import { z } from 'zod';

/** Contrato de las misiones (F5). Persistido en el navegador (D15); en B3, en la base propia. */

const isoInstant = z.string().datetime({ offset: true });

export const REPORT_LENGTHS = ['kurz', 'mittel', 'ausfuehrlich'] as const;
export const OBJECTIVE_MAX = 200;
export const EXPECTED_MAX = 400;

export const MissionInputSchema = z.object({
  objective: z.string().trim().min(5).max(OBJECTIVE_MAX),
  expected: z.string().trim().max(EXPECTED_MAX),
  length: z.enum(REPORT_LENGTHS),
});
export type MissionInput = z.infer<typeof MissionInputSchema>;

export const STEP_KINDS = ['plan', 'work', 'report', 'revision'] as const;
export const MissionStepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(STEP_KINDS),
  agentId: z.string().min(1),
  text: z.string().min(1).max(300),
  status: z.enum(['pending', 'working', 'done']),
  startedAt: isoInstant.nullable(),
  finishedAt: isoInstant.nullable(),
});
export type MissionStep = z.infer<typeof MissionStepSchema>;

export const MISSION_STATUSES = ['planning', 'awaiting-plan', 'running', 'awaiting-result', 'done', 'rejected', 'cancelled'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const DecisionSchema = z.object({
  kind: z.enum(['plan', 'result']),
  approve: z.boolean(),
  requestedAt: isoInstant,
  at: isoInstant,
});
export type Decision = z.infer<typeof DecisionSchema>;

/** Foto de MethaDesk al crear la misión, para el informe. */
export const MissionContextSchema = z.object({
  hasData: z.boolean(),
  open: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  rework: z.number().int().nonnegative(),
});
export type MissionContext = z.infer<typeof MissionContextSchema>;

export const MissionSchema = z.object({
  id: z.string().min(1),
  objective: z.string().min(1).max(OBJECTIVE_MAX),
  expected: z.string().max(EXPECTED_MAX),
  length: z.enum(REPORT_LENGTHS),
  createdAt: isoInstant,
  updatedAt: isoInstant,
  status: z.enum(MISSION_STATUSES),
  /** Desde cuándo espera la Freigabe actual (plan o resultado). */
  awaitingSince: isoInstant.nullable(),
  steps: z.array(MissionStepSchema).min(1).max(12),
  decisions: z.array(DecisionSchema).max(20),
  report: z.string().max(20_000).nullable(),
  context: MissionContextSchema.nullable(),
});
export type Mission = z.infer<typeof MissionSchema>;
