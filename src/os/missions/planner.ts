import { ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { SPECIALISTS, type SpecialistId } from '@/features/city/model/specialists';
import type { UnitId } from '@/features/city/model/types';
import { format, type Messages } from '@/i18n';
import type { MissionStep } from './contract';

/**
 * Planificador del MVP (D17): el Chief reparte el objetivo entre unidades y especialistas
 * contratados según palabras clave en alemán. Determinista y sin LLM.
 */

export const MAX_AGENTS = 4;
const DEFAULT_AGENTS: readonly UnitId[] = ['avor', 'projektleitung'];
const OBJECTIVE_IN_TEXT = 60;

const UNIT_RULES: readonly (readonly [RegExp, readonly UnitId[]])[] = [
  [/montage|baustelle|monteur|abruf/, ['bauleitung', 'bau']],
  [/bestell|material|liefer|einkauf|beschaff/, ['einkauf', 'werkhof']],
  [/fertig|schlosser|blech|produktion|werkstatt|schweiss/, ['avor', 'schlosserei', 'blech']],
  [/projekt|bericht|risiko|meilenstein|planer/, ['projektleitung']],
  [/lager|versand|kommission/, ['werkhof']],
];

const SPECIALIST_RULES: Readonly<Record<SpecialistId, RegExp>> = {
  kalkulation: /offert|kalkul|preis/,
  terminplanung: /termin|zeitplan/,
  qualitaet: /qualit|prüf|mangel|reklam/,
  arbeitssicherheit: /sicherheit|unfall/,
  dokumentation: /dokument|rapport|protokoll/,
  controlling: /kosten|controlling|budget/,
  personal: /personal|ferien|team/,
  lieferanten: /lieferant/,
  logistik: /transport|tour|logistik/,
  bim: /modell|bim/,
  nachkalkulation: /nachkalk|abrechnung/,
  kundendienst: /kunde|service|garantie/,
  it: /\bit\b|computer|zugang|software/,
  recht: /vertrag|recht|nachtrag/,
};

/** Agentes que trabajarán en la misión, por orden: unidades y luego especialistas contratados. */
export function pickAgents(objective: string, activeSpecialists: readonly string[]): string[] {
  const text = objective.toLowerCase();
  const units = UNIT_RULES.flatMap(([re, ids]) => (re.test(text) ? ids : []));
  const specialists = SPECIALISTS.filter((s) => activeSpecialists.includes(s.id) && SPECIALIST_RULES[s.id].test(text)).map((s) => s.id);
  const chosen = [...new Set<string>([...units, ...specialists])].slice(0, MAX_AGENTS);
  return chosen.length > 0 ? chosen : [...DEFAULT_AGENTS];
}

const short = (objective: string) =>
  objective.length > OBJECTIVE_IN_TEXT ? `${objective.slice(0, OBJECTIVE_IN_TEXT - 1).trimEnd()}…` : objective;

const step = (index: number, kind: MissionStep['kind'], agentId: string, text: string): MissionStep => ({
  id: `s${index}`, kind, agentId, text, status: 'pending', startedAt: null, finishedAt: null,
});

export function planSteps(objective: string, activeSpecialists: readonly string[], m: Messages): MissionStep[] {
  const vars = { objective: short(objective) };
  const work = pickAgents(objective, activeSpecialists).map((agentId, i) => {
    const role = SPECIALISTS.find((s) => s.id === agentId);
    const template = m.missions.stepTemplates[i % m.missions.stepTemplates.length] ?? '';
    const text = role ? format(m.missions.specialistStep, { role: m.specialists[role.id].name, ...vars }) : format(template, vars);
    return step(i + 1, 'work', agentId, text);
  });
  return [
    step(0, 'plan', ORCHESTRATOR_AGENT, format(m.missions.planStep, vars)),
    ...work,
    step(work.length + 1, 'report', ORCHESTRATOR_AGENT, m.missions.reportStep),
  ];
}
