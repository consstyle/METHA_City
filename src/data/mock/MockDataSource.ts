import 'server-only';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { todayInZurich } from '@/lib/dates';
import { aggregateUnits, mapProjects } from '../aggregate';
import type { CityDataSource, CitySnapshot, GetSnapshotOptions } from '../contract';
import {
  MOCK_SCENARIOS, agentStates, alertAbteilungen, alertProjekte, baselineAbteilungen, baselineProjekte,
  emptyAbteilungen, type MockScenario,
} from './scenarios';

export interface MockDataSourceOptions {
  readonly scenario?: MockScenario;
  readonly now?: () => Date;
  /** Demora artificial para ver los estados de carga. */
  readonly delayMs?: number;
}

const abortError = () => new DOMException('Operación cancelada', 'AbortError');

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Fuente de datos simulada con la misma forma que tendrá la API (PLAN-DESARROLLO.md §4.3). */
export class MockDataSource implements CityDataSource {
  private readonly scenario: MockScenario;
  private readonly now: () => Date;
  private readonly delayMs: number;

  constructor({ scenario = 'normal', now = () => new Date(), delayMs = 0 }: MockDataSourceOptions = {}) {
    this.scenario = scenario;
    this.now = now;
    this.delayMs = delayMs;
  }

  async getSnapshot({ signal }: GetSnapshotOptions = {}): Promise<CitySnapshot> {
    if (signal?.aborted) throw abortError();
    await wait(this.delayMs, signal);
    if (this.scenario === 'fehler') throw new Error('Simulador: error de datos simulado');

    const scenario = this.scenario;
    const now = this.now();
    const today = todayInZurich(now);
    const rows = { normal: baselineAbteilungen, alarme: alertAbteilungen, leer: emptyAbteilungen }[scenario](today);
    const projects = scenario === 'leer' ? [] : (scenario === 'alarme' ? alertProjekte : baselineProjekte)(today);

    return {
      source: 'mock',
      generatedAt: now.toISOString(),
      dataAsOf: now.toISOString(),
      units: aggregateUnits(CAMPUS_UNITS, rows, agentStates(scenario)),
      projects: mapProjects(projects),
    };
  }
}

/** Lee el escenario de un parámetro de URL; cualquier valor desconocido vuelve a «normal». */
export function parseScenario(value: unknown): MockScenario {
  const raw = Array.isArray(value) ? value[0] : value;
  return MOCK_SCENARIOS.find((s) => s === raw) ?? 'normal';
}
