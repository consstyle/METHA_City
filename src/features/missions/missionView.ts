import type { SnapshotResult } from '@/data/load';
import { projectTeamIds } from '@/features/city/model/projects';
import type { MissionContext } from '@/os/missions/contract';
import type { PlannerProject } from '@/os/missions/planner';

/** Foto de MethaDesk para el informe: suma de las unidades con datos (null si la fuente falló). */
export function contextFromSnapshot(result: SnapshotResult): MissionContext | null {
  if (!result.ok) return null;
  const units = result.snapshot.units.filter((u) => u.hasData);
  const sum = (pick: (u: (typeof units)[number]) => number) => units.reduce((s, u) => s + pick(u), 0);
  return {
    hasData: units.length > 0,
    open: sum((u) => u.ts.offen),
    total: sum((u) => u.ts.total),
    overdue: sum((u) => u.alerts.montageUeberfaellig),
    rework: sum((u) => u.alerts.nachbearbeitung),
  };
}

/** Proyectos activos con sus agentes, para que el plan reparta el trabajo de obra (F5c). */
export function projectsFromSnapshot(result: SnapshotResult): PlannerProject[] {
  if (!result.ok) return [];
  const ids = projectTeamIds(result.snapshot.projects);
  return result.snapshot.projects.flatMap((p) => {
    const agents = ids.get(p.projektId);
    return agents ? [{ projektnummer: p.projektnummer, projektname: p.projektname, agents }] : [];
  });
}

/** Bloques del informe Markdown para pintarlo con React (sin innerHTML). */
export type ReportBlock =
  | { readonly type: 'h1' | 'h2' | 'p' | 'quote' | 'byline'; readonly text: string }
  | { readonly type: 'list'; readonly items: readonly { readonly strong: string | null; readonly text: string }[] };

export function parseReport(markdown: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  for (const line of markdown.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('- ')) {
      const match = /^- \*\*(.+?)\*\*: (.*)$/.exec(line);
      const item = match ? { strong: match[1] ?? null, text: match[2] ?? '' } : { strong: null, text: line.slice(2) };
      const last = blocks.at(-1);
      if (last?.type === 'list') blocks[blocks.length - 1] = { type: 'list', items: [...last.items, item] };
      else blocks.push({ type: 'list', items: [item] });
    } else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: line.slice(3) });
    else if (line.startsWith('# ')) blocks.push({ type: 'h1', text: line.slice(2) });
    else if (line.startsWith('> ')) blocks.push({ type: 'quote', text: line.slice(2) });
    else if (/^_.*_$/.test(line)) blocks.push({ type: 'byline', text: line.slice(1, -1) });
    else blocks.push({ type: 'p', text: line });
  }
  return blocks;
}

/** Nombre de archivo seguro para descargar el informe. */
export function reportFileName(objective: string): string {
  const slug = objective
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `bericht-${slug || 'mission'}.md`;
}
