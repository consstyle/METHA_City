import type { Messages } from '@/i18n';
import { composeReply, type Attachment, type ReplyContext } from './replies';
import { streamText, type Scheduler, type StreamResult } from './stream';

/**
 * Pasarela única hacia los agentes (PLAN-DESARROLLO.md §4.2). En el MVP la implementa
 * `SimulatedAgentGateway`; en B4, `HermesGateway` (API del servidor + SSE) con la misma forma.
 */

/** Datos del momento que el motor simulado usa para responder (Hermes no los necesitará). */
export type ReplyData = Omit<ReplyContext, 'agentId' | 'text' | 'attachments'>;

export interface ChatRequest {
  readonly agentId: string;
  readonly text: string;
  readonly attachments: readonly Attachment[];
  readonly data: ReplyData;
  /** Instrucciones permanentes del perfil. El motor simulado no las usa; Hermes sí (B4). */
  readonly instructions?: string | null;
}

export interface ReplyOptions {
  readonly onChunk: (sofar: string) => void;
  readonly signal: AbortSignal;
}

export interface AgentGateway {
  reply(request: ChatRequest, options: ReplyOptions): Promise<StreamResult>;
}

export function createSimulatedGateway(m: Messages, options: { delayMs?: number; scheduler?: Scheduler } = {}): AgentGateway {
  return {
    reply: (request, { onChunk, signal }) =>
      streamText(composeReply({ ...request.data, agentId: request.agentId, text: request.text, attachments: request.attachments }, m), {
        onChunk,
        signal,
        delayMs: options.delayMs,
        scheduler: options.scheduler,
      }),
  };
}
