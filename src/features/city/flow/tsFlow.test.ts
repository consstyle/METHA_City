import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceCarrier, ARRIVE_SECONDS, carrierScale, createCarrier, routeLength } from './carrier';
import { createFlowStore } from './flowStore';
import {
  createFlowDemo, demoTick, FEED_SIZE, MAX_TS, pushFeed, releaseAll, releaseTs, REST_MS, WORKSHOPS, type FeedEntry, type FlowDemo,
} from './tsFlow';

test('el store conserva simulación, reloj y feed (con número de orden) entre visitas a la ciudad', () => {
  const store = createFlowStore();
  const event = store.getState().next(1000, seq(0.9, 0, 0))!;
  store.getState().record(event);
  store.getState().record(event);
  const { feed, clock } = store.getState();
  assert.equal(clock, 1000);
  assert.deepEqual(feed.map((f) => f.seq), [1, 0], 'claves distintas aunque se repita el TS');
  store.getState().remount();
  assert.ok(store.getState().demo.ts.every((t) => t.until !== Number.POSITIVE_INFINITY));
  store.getState().arrived(event.nr, 500);
  assert.equal(store.getState().clock, 1500);
  assert.equal(store.getState().motionDefaultApplied, false);
  store.getState().markMotionDefault();
  assert.equal(store.getState().motionDefaultApplied, true);
});

/** Generador fijo para que la simulación sea reproducible en las pruebas. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

test('el ciclo de un TS: Plan fertig → reparto de AVOR → bereit → fertig a la obra', () => {
  let demo: FlowDemo = { next: 1, ts: [] };
  const kinds: string[] = [];
  let t = 0;
  for (let i = 0; i < 4; i++) {
    // Orden de los sorteos: ¿TS nuevo? (0.9 = no) → cuál de los libres (0) → taller (0 = Schlosserei).
    const r = demoTick(demo, t, seq(0.9, 0, 0));
    demo = r.demo;
    kinds.push(`${r.event!.kind}:${r.event!.from}>${r.event!.to}`);
    demo = releaseTs(demo, r.event!.nr, t); // su camión llega…
    t += REST_MS; // …y descansa
  }
  assert.deepEqual(kinds, ['plan:projektleitung>avor', 'zuteilung:avor>schlosserei', 'bereit:schlosserei>avor', 'fertig:avor>bau']);
  assert.deepEqual(demo.ts, [], 'al llegar a la obra sale de la simulación');
});

test('un TS recién movido descansa; si todos descansan, entra uno nuevo con el siguiente número', () => {
  const start = createFlowDemo();
  const first = demoTick(start, 1000, seq(0.9, 0));
  assert.ok(first.event);
  const busy = { next: 50, ts: [{ nr: 7, stage: 1, dept: null, until: 99_999 }] };
  const r = demoTick(busy, 1000, seq(0.9));
  assert.deepEqual([r.event!.nr, r.event!.kind], [50, 'plan']);
  assert.equal(r.demo.next, 51);
  assert.equal(r.demo.ts.length, 2);
});

test('AVOR reparte entre Schlosserei, Blech y Einkauf, y el TS vuelve desde el mismo taller', () => {
  for (const [i, dept] of WORKSHOPS.entries()) {
    const demo = { next: 9, ts: [{ nr: 1, stage: 1, dept: null, until: 0 }] };
    const zut = demoTick(demo, 0, seq(0.9, 0, (i + 0.5) / WORKSHOPS.length));
    assert.equal(zut.event!.to, dept);
    const back = demoTick(releaseTs(zut.demo, 1, -REST_MS), 1, seq(0.9, 0));
    assert.deepEqual([back.event!.from, back.event!.kind], [dept, 'bereit']);
  }
});

test('el feed guarda los últimos movimientos, el más reciente arriba', () => {
  const ev = (nr: number): FeedEntry => ({ nr, from: 'avor', to: 'bau', kind: 'fertig', seq: nr });
  const feed = Array.from({ length: 9 }, (_, i) => ev(i)).reduce<FeedEntry[]>((f, e) => pushFeed(f, e), []);
  assert.equal(feed.length, FEED_SIZE);
  assert.equal(feed[0]!.nr, 8);
});

test('un TS en camino no vuelve a salir hasta que llega y descansa (nunca dos camiones con el mismo TS)', () => {
  const r = demoTick({ next: 1, ts: [] }, 0, seq(0.9));
  const nr = r.event!.nr;
  // Mucho tiempo después, si su camión no ha llegado, sigue ocupado: entra uno nuevo.
  const later = demoTick(r.demo, 10 * REST_MS, seq(0.9));
  assert.notEqual(later.event!.nr, nr);
  const released = releaseTs(later.demo, nr, 10 * REST_MS);
  assert.equal(demoTick(released, 10 * REST_MS + REST_MS - 1, seq(0.9, 0)).event!.nr !== nr, true, 'aún descansa');
  const free = demoTick(released, 11 * REST_MS, seq(0.9, 0, 0));
  assert.ok([nr, later.event!.nr].includes(free.event!.nr));
});

test('como mucho MAX_TS en el ciclo; releaseAll libera los que esperaban a un camión que ya no existe', () => {
  let demo: FlowDemo = { next: 1, ts: [] };
  for (let i = 0; i < MAX_TS + 3; i++) demo = demoTick(demo, 0, seq(0.1)).demo;
  assert.equal(demo.ts.length, MAX_TS);
  assert.equal(demoTick(demo, 0, seq(0.1)).event, null, 'todos ocupados y sin hueco: no hay movimiento');
  const freed = releaseAll(demo, 5);
  assert.ok(freed.ts.every((t) => t.until === 5));
  assert.ok(demoTick(freed, 5, seq(0.9, 0, 0)).event);
});

test('el camión recorre su ruta, gira hacia cada tramo, llega, se encoge y termina', () => {
  const path = [[0, 0], [4, 0], [4, 3]] as const;
  let c = createCarrier(0, { nr: 1, from: 'avor', to: 'bau', kind: 'fertig' }, path, 2);
  assert.equal(routeLength(c), 7);
  c = advanceCarrier(c, 1);
  assert.deepEqual([c.x, c.z, c.phase], [2, 0, 'drive']);
  c = advanceCarrier(c, 1.5);
  assert.deepEqual([c.x, c.z.toFixed(2), c.seg], [4, '1.00', 1]);
  // Con un paso pequeño el giro es gradual: queda entre el rumbo del tramo anterior y el del nuevo.
  const turning = advanceCarrier({ ...c, heading: Math.PI / 2 }, 0.02);
  assert.ok(turning.heading < Math.PI / 2 && turning.heading > 0, `gira poco a poco (${turning.heading.toFixed(2)})`);
  c = advanceCarrier(c, 1.2);
  assert.equal(c.phase, 'arrive');
  assert.deepEqual([c.x, c.z], [4, 3]);
  c = advanceCarrier(c, ARRIVE_SECONDS / 2);
  assert.ok(carrierScale(c) > 0.4 && carrierScale(c) < 0.6);
  c = advanceCarrier(c, ARRIVE_SECONDS);
  assert.equal(c.phase, 'done');
  assert.equal(advanceCarrier(c, 1), c);
  assert.throws(() => createCarrier(0, { nr: 1, from: 'avor', to: 'bau', kind: 'fertig' }, [[0, 0]], 1), /two points/);
});
