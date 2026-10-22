'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format, type Messages } from '@/i18n';
import { useScenarioQuery } from './useScenarioQuery';

type NavKey = keyof Omit<Messages['nav'], 'label' | 'soon' | 'soonTitle'>;

interface RailItem {
  readonly key: NavKey;
  readonly href: string | null;
  /** Fase en la que llega el módulo (si aún no está disponible). */
  readonly phase?: string;
  readonly icon: string;
}

/** Módulos del sistema (PLAN-DESARROLLO.md §2): los del MVP aún no hechos aparecen como «BALD». */
const ITEMS: readonly RailItem[] = [
  { key: 'city', href: '/', icon: 'm12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5' },
  { key: 'cockpit', href: '/leitstand', icon: 'M3 13h8V3H3Z M13 21h8V11h-8Z M13 3v6h8V3Z M3 21h8v-6H3Z' },
  { key: 'agents', href: null, phase: 'F4', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0' },
  { key: 'chat', href: null, phase: 'F4', icon: 'M4 5h16v11H9l-5 4Z' },
  { key: 'missions', href: null, phase: 'F5', icon: 'M5 21V4 M5 4h12l-2 4 2 4H5' },
  { key: 'tasks', href: null, phase: 'F5', icon: 'M4 4h5v16H4Z M10 4h5v10h-5Z M16 4h4v7h-4Z' },
  { key: 'approvals', href: null, phase: 'F5', icon: 'M4 12l5 5L20 6' },
  { key: 'activity', href: null, phase: 'F5', icon: 'M3 12h4l3-8 4 16 3-8h4' },
];

export function ModuleRail({ m }: Readonly<{ m: Messages }>) {
  const pathname = usePathname();
  const query = useScenarioQuery();
  return (
    <nav className="module-rail" aria-label={m.nav.label}>
      {ITEMS.map((item) => {
        const label = m.nav[item.key];
        const icon = (
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d={item.icon} />
          </svg>
        );
        if (!item.href) {
          const soon = format(m.nav.soonTitle, { phase: item.phase ?? '' });
          return (
            <span key={item.key} className="rail-item disabled" aria-disabled="true" title={soon}>
              {icon}
              <span className="rail-label">{label}</span>
              <span className="rail-soon" aria-hidden="true">{m.nav.soon}</span>
              <span className="sr-only">, {soon}</span>
            </span>
          );
        }
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link key={item.key} href={`${item.href}${query}`} className={`rail-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {icon}
            <span className="rail-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
