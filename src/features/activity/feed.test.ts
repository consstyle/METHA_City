import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessages } from '@/i18n';
import type { ActivityEvent } from '@/os/contract';
import { buildFeed, FEED_KINDS, filterFeed, type FeedFilter } from './feed';

const m = getMessages();
const ev = (id: string, at: string, type: ActivityEvent['type'], agentId: string, targetAgentId: string | null = null, note: string | null = null): ActivityEvent =>
  ({ id, tick: 1, at, type, agentId, targetAgentId, taskIndex: note ? null : 0, note });
const ALL: FeedFilter = { agentId: null, kinds: new Set(FEED_KINDS), query: '', comms: false };

const activity = [
  ev('1', '2026-10-22T08:00:01Z', 'started', 'werkhof'),
  ev('2', '2026-10-22T08:00:02Z', 'delegated', 'chief', 'bl-dev-001', 'Montageplan prüfen'),
  ev('3', '2026-10-22T08:00:03Z', 'approval', 'einkauf'),
  ev('4', '2026-10-22T08:00:04Z', 'completed', 'bl-dev-001', null, 'Montageplan prüfen'),
];
const journal = [{ id: 'j1', at: '2026-10-22T08:00:05Z', kind: 'hiring' as const, agentId: 'bim', text: 'BIM-Koordination eingestellt' }];

test('une actividad en vivo y diario, lo más reciente primero, con su tipo', () => {
  const feed = buildFeed(activity, journal, m);
  assert.deepEqual(feed.map((f) => [f.kind, f.source]), [
    ['hiring', 'journal'], ['mission', 'live'], ['approval', 'live'], ['delegation', 'live'], ['work', 'live'],
  ]);
  assert.equal(feed[3]!.text, 'Methabau Chief delegiert an Bauleitung DEV-001: Montageplan prüfen');
  assert.deepEqual(feed[3]!.agentIds, ['chief', 'bl-dev-001']);
});

test('filtros por agente (también como destino), tipo, texto y comunicación', () => {
  const feed = buildFeed(activity, journal, m);
  assert.deepEqual(filterFeed(feed, { ...ALL, agentId: 'bl-dev-001' }).map((f) => f.id), ['live:4', 'live:2']);
  assert.deepEqual(filterFeed(feed, { ...ALL, kinds: new Set(['hiring']) }).map((f) => f.id), ['journal:j1']);
  assert.deepEqual(filterFeed(feed, { ...ALL, query: '  PLAN PRÜFEN ' }).map((f) => f.id), ['live:4', 'live:2']);
  assert.deepEqual(filterFeed(feed, { ...ALL, comms: true }).map((f) => f.id), ['live:2']);
  assert.deepEqual(filterFeed(feed, { ...ALL, kinds: new Set() }), []);
});
