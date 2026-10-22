import type { Messages } from '@/i18n';
import type { ActivityEvent } from '@/os/contract';
import { activityText } from '@/os/format';
import type { JournalEntry } from '@/os/journal';

/** Aktivität (D21): actividad en vivo del motor + diario persistente, en una sola lista filtrable. */

export const FEED_KINDS = ['work', 'delegation', 'approval', 'mission', 'hiring'] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export interface FeedItem {
  readonly id: string;
  readonly at: string;
  readonly kind: FeedKind;
  readonly source: 'live' | 'journal';
  readonly agentIds: readonly string[];
  readonly text: string;
}

export interface FeedFilter {
  readonly agentId: string | null;
  readonly kinds: ReadonlySet<FeedKind>;
  readonly query: string;
  /** Solo comunicación entre agentes (delegaciones). */
  readonly comms: boolean;
}

function liveKind(e: ActivityEvent): FeedKind {
  if (e.type === 'delegated') return 'delegation';
  if (e.type === 'approval' || e.type === 'approved') return 'approval';
  return e.note ? 'mission' : 'work';
}

export function buildFeed(activity: readonly ActivityEvent[], journal: readonly JournalEntry[], m: Messages): FeedItem[] {
  const live = activity.map((e): FeedItem => ({
    id: `live:${e.id}`, at: e.at, kind: liveKind(e), source: 'live',
    agentIds: e.targetAgentId ? [e.agentId, e.targetAgentId] : [e.agentId], text: activityText(e, m),
  }));
  const stored = journal.map((e): FeedItem => ({
    id: `journal:${e.id}`, at: e.at, kind: e.kind, source: 'journal', agentIds: e.agentId ? [e.agentId] : [], text: e.text,
  }));
  return [...live, ...stored].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function filterFeed(items: readonly FeedItem[], f: FeedFilter): FeedItem[] {
  const query = f.query.trim().toLowerCase();
  return items.filter((item) =>
    (!f.comms || item.kind === 'delegation') &&
    f.kinds.has(item.kind) &&
    (f.agentId === null || item.agentIds.includes(f.agentId)) &&
    (!query || item.text.toLowerCase().includes(query)),
  );
}
