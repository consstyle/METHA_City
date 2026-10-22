import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { deriveRelations } from '@/features/city/model/hierarchy';
import { format, type Messages } from '@/i18n';
import { agentName, agentTaskText } from '../format';
import { delegationTargets, type SimAgent } from '../simulation/engine';
import { projectLinks, specialistLinks, type ProjectTeam } from '../simulation/roster';
import { profileOf } from './profile';

/**
 * Respuestas guionizadas del motor del MVP (D10): se reconocen intenciones con palabras clave en
 * alemán y se responde con el estado real de la simulación y los datos de MethaDesk. Sin LLM.
 */

export const INTENTS = ['greeting', 'status', 'kpis', 'help', 'delegate', 'thanks'] as const;
export type Intent = (typeof INTENTS)[number];

const PATTERNS: Record<Intent, RegExp> = {
  greeting: /\b(hallo|grüezi|gruezi|hoi|servus|sali|guten (morgen|tag|abend))\b/,
  status: /(status|woran|was machst|beschäftigt|gerade)/,
  kpis: /(zahl|methadesk|überfällig|ueberfaellig|montage|nachbearbeitung|teilsystem|alarm)/,
  help: /(hilfe|was kannst|wofür|zuständig)/,
  delegate: /(übernimm|uebernimm|erledig|auftrag|delegier|kümmer|kuemmer)/,
  thanks: /(danke|merci)/,
};

export type KpiContext =
  | { readonly kind: 'unit'; readonly hasData: boolean; readonly open: number; readonly total: number; readonly overdue: number; readonly rework: number }
  | { readonly kind: 'all'; readonly overdue: number; readonly rework: number }
  | { readonly kind: 'project'; readonly projekt: string; readonly total: number; readonly verbaut: number; readonly overdue: number; readonly rework: number }
  | { readonly kind: 'specialist' }
  | { readonly kind: 'unavailable' };

export interface Attachment {
  readonly name: string;
  readonly size: number;
}

export interface ReplyContext {
  readonly agentId: string;
  readonly text: string;
  readonly attachments: readonly Attachment[];
  /** Estado del agente en la simulación (puede faltar mientras arranca). */
  readonly agent: SimAgent | undefined;
  readonly kpis: KpiContext;
  /** Especialistas contratados (para a quién puede delegar una unidad). */
  readonly specialists: readonly string[];
  /** Equipos de los proyectos activos (Chief → Projektleitung → Bauleitung, AVOR ↔ Bauleitung). */
  readonly teams?: readonly ProjectTeam[];
}

const RELATIONS = deriveRelations(CAMPUS_UNITS);

export function detectIntents(text: string): Intent[] {
  const lower = text.toLowerCase();
  return INTENTS.filter((i) => PATTERNS[i].test(lower));
}

const joinNames = (names: readonly string[], m: Messages) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ${m.replies.and} ${names.at(-1)}`;

function statusReply(c: ReplyContext, m: Messages): string {
  const a = c.agent;
  const task = a ? agentTaskText(a, m) : '';
  if (!a || a.state === 'idle' || !task) return m.replies.statusIdle;
  return format(a.state === 'waiting' ? m.replies.statusWaiting : m.replies.statusWorking, { task });
}

function kpiReply(c: ReplyContext, m: Messages): string {
  const k = c.kpis;
  const unit = agentName(c.agent?.unitId ?? c.agentId, m);
  if (k.kind === 'unavailable') return m.replies.kpisUnavailable;
  if (k.kind === 'all') return format(m.replies.kpisChief, { overdue: k.overdue, rework: k.rework });
  if (k.kind === 'project') return format(m.replies.kpisProject, { projekt: k.projekt, total: k.total, verbaut: k.verbaut, overdue: k.overdue, rework: k.rework });
  if (k.kind === 'specialist') return format(m.replies.kpisSpecialist, { unit });
  if (!k.hasData) return format(m.replies.kpisNone, { unit });
  return format(m.replies.kpis, { unit, open: k.open, total: k.total, overdue: k.overdue, rework: k.rework });
}

function delegateReply(c: ReplyContext, m: Messages): string {
  const links = [...specialistLinks(c.specialists), ...projectLinks(c.teams ?? [])];
  const targets = delegationTargets(c.agentId, RELATIONS, links).map((t) => agentName(t, m));
  if (c.agent?.kind === 'orchestrator') return format(m.replies.chiefDelegate, { targets: joinNames(targets, m) });
  if (targets.length === 0) return m.replies.delegateAlone;
  return format(m.replies.delegate, { target: joinNames(targets, m) });
}

export function composeReply(c: ReplyContext, m: Messages): string {
  const name = agentName(c.agentId, m);
  const intents = detectIntents(c.text);
  const answers: Record<Intent, () => string> = {
    // Si el saludo acompaña una pregunta, basta con presentarse.
    greeting: () => format(intents.length > 1 ? m.replies.greetingShort : m.replies.greeting, { agent: name }),
    status: () => statusReply(c, m),
    kpis: () => kpiReply(c, m),
    help: () => format(m.replies.help, { list: profileOf(c.agentId, m).responsibilities.map((r) => r.replace(/\.$/, '')).join(', ') }),
    delegate: () => delegateReply(c, m),
    thanks: () => m.replies.thanks,
  };
  const parts = intents.map((i) => answers[i]());
  if (parts.length === 0) parts.push(m.replies.fallback);
  if (c.attachments.length > 0) {
    parts.push(format(m.replies.attachments, { n: c.attachments.length, names: c.attachments.map((a) => a.name).join(', ') }));
  }
  return parts.join(' ');
}
