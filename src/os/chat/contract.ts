import { z } from 'zod';

/** Contrato del chat (F4). Lo persiste el navegador (D15) y en B3 lo guardará la base propia. */

const isoInstant = z.string().datetime({ offset: true });
export const MESSAGE_MAX = 4_000;
export const MESSAGE_LIMIT = 200;
export const ATTACHMENT_LIMIT = 10;
export const ATTACHMENT_NAME_MAX = 255;

export const AttachmentSchema = z.object({ name: z.string().min(1).max(ATTACHMENT_NAME_MAX), size: z.number().int().nonnegative() });

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'agent']),
  text: z.string().max(MESSAGE_MAX),
  at: isoInstant,
  /** D16: solo nombre y tamaño, nunca el contenido. */
  attachments: z.array(AttachmentSchema).max(ATTACHMENT_LIMIT),
  /** La respuesta se interrumpió (Stopp o error). */
  stopped: z.boolean(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  createdAt: isoInstant,
  updatedAt: isoInstant,
  messages: z.array(ChatMessageSchema).max(MESSAGE_LIMIT),
});
export type Conversation = z.infer<typeof ConversationSchema>;

/** Una conversación dañada se descarta sola: no se pierde el resto del historial. */
export const ChatPersistSchema = z.object({
  conversations: z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const parsed = ConversationSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});
