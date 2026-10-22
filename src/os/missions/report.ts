import { format, type Messages } from '@/i18n';
import { formatDateCh, todayInZurich } from '@/lib/dates';
import { agentName } from '../format';
import type { Mission } from './contract';

/** Informe de la misión en Markdown (D21), con más o menos secciones según el umfang elegido. */
export function buildReport(mission: Mission, m: Messages, now: Date): string {
  const r = m.report;
  const work = mission.steps.filter((s) => s.kind === 'work');
  const agents = [...new Set(work.map((s) => agentName(s.agentId, m)))];
  const revisions = mission.decisions.filter((d) => d.kind === 'result' && !d.approve).length;
  const lines: string[] = [
    `# ${format(r.title, { objective: mission.objective })}`,
    `_${format(r.byline, { date: formatDateCh(todayInZurich(now)) })}_`,
    '',
    `## ${r.summaryTitle}`,
    format(r.summary, { n: mission.steps.length, agents: agents.join(', ') }),
  ];
  // En una sola línea: un «## …» o «- …» escrito por el usuario no debe cambiar la estructura del informe.
  if (mission.expected) lines.push('', format(r.expected, { expected: mission.expected.replace(/\s+/g, ' ').trim() }));
  if (revisions > 0) lines.push('', format(r.revised, { n: revisions }));
  if (mission.length !== 'kurz') {
    lines.push('', `## ${r.stepsTitle}`, ...mission.steps.map((s) => `- **${agentName(s.agentId, m)}**: ${s.text}`));
  }
  if (mission.length === 'ausfuehrlich') {
    const c = mission.context;
    lines.push('', `## ${r.kpisTitle}`, c?.hasData ? format(r.kpis, { open: c.open, total: c.total, overdue: c.overdue, rework: c.rework }) : r.kpisNone);
    lines.push('', `## ${r.nextTitle}`, ...r.next.map((n) => `- ${n}`));
  }
  lines.push('', `> ${r.note}`);
  return lines.join('\n');
}
