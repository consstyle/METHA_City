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
const DEFAULT_AGENTS: readonly UnitId[] = ['avor', 'planer'];
const OBJECTIVE_IN_TEXT = 60;

/** Proyecto activo con su equipo (F5c, D28). */
export interface PlannerProject {
  readonly projektnummer: string;
  readonly projektname: string;
  readonly agents: { readonly pl: string; readonly bl: string };
}

/** Reglas del campus (edificios) y de obra (equipo de cada proyecto: Bauleitung o Projektleitung). */
const UNIT_RULES: readonly (readonly [RegExp, readonly UnitId[]])[] = [
  [/bestell|material|liefer|einkauf|beschaff/, ['einkauf', 'werkhof']],
  [/fertig|schlosser|blech|produktion|werkstatt|schweiss/, ['avor', 'schlosserei', 'blech']],
  [/zeichnung|pläne|konstrukt|planer\b|planung/, ['planer']],
  [/lager|versand|kommission/, ['werkhof']],
];
const SITE_RULES: readonly (readonly [RegExp, 'bl' | 'pl'])[] = [
  [/montage|baustelle|monteur|abruf/, 'bl'],
  [/projekt|bericht|risiko|meilenstein/, 'pl'],
];

/** Si el objetivo no nombra ningún proyecto, solo trabajan las primeras obras (deja sitio a edificios y especialistas). */
const UNNAMED_SITE_LIMIT = 2;

/** Proyectos que nombra el objetivo (número o primera palabra del nombre); si no nombra ninguno, los primeros. */
function targetProjects(text: string, projects: readonly PlannerProject[]): readonly PlannerProject[] {
  const firstWord = (name: string) => name.toLowerCase().split(/[\s,;]+/)[0] ?? '';
  const named = projects.filter((p) => text.includes(p.projektnummer.toLowerCase()) || (firstWord(p.projektname).length > 3 && text.includes(firstWord(p.projektname))));
  return named.length > 0 ? named : projects.slice(0, UNNAMED_SITE_LIMIT);
}

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

/** Agentes que trabajarán en la misión, por orden: equipos de obra, edificios y especialistas contratados. */
export function pickAgents(objective: string, activeSpecialists: readonly string[], projects: readonly PlannerProject[] = []): string[] {
  const text = objective.toLowerCase();
  const targets = targetProjects(text, projects);
  const site = SITE_RULES.flatMap(([re, role]) => (re.test(text) ? targets.map((p) => p.agents[role]) : []));
  const units = UNIT_RULES.flatMap(([re, ids]) => (re.test(text) ? ids : []));
  const specialists = SPECIALISTS.filter((s) => activeSpecialists.includes(s.id) && SPECIALIST_RULES[s.id].test(text)).map((s) => s.id);
  const chosen = [...new Set<string>([...site, ...units, ...specialists])].slice(0, MAX_AGENTS);
  return chosen.length > 0 ? chosen : [...DEFAULT_AGENTS];
}

const short = (objective: string) =>
  objective.length > OBJECTIVE_IN_TEXT ? `${objective.slice(0, OBJECTIVE_IN_TEXT - 1).trimEnd()}…` : objective;

const step = (index: number, kind: MissionStep['kind'], agentId: string, text: string): MissionStep => ({
  id: `s${index}`, kind, agentId, text, status: 'pending', startedAt: null, finishedAt: null,
});

export function planSteps(objective: string, activeSpecialists: readonly string[], m: Messages, projects: readonly PlannerProject[] = []): MissionStep[] {
  const vars = { objective: short(objective) };
  const work = pickAgents(objective, activeSpecialists, projects).map((agentId, i) => {
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
