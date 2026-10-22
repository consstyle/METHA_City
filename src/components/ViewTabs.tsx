'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCity, useCityStoreApi } from '@/features/city/state/CityStoreProvider';
import type { CityView } from '@/features/city/state/cityStore';
import type { Messages } from '@/i18n';
import { useScenarioQuery } from './useScenarioQuery';

/** Pestañas «3D-Stadt» y «Hierarchie» de la cabecera de preview.html. */
export function ViewTabs({ m }: Readonly<{ m: Messages }>) {
  const store = useCityStoreApi();
  const view = useCity((s) => s.view);
  const pathname = usePathname();
  const router = useRouter();
  const query = useScenarioQuery();
  const onCity = pathname === '/';

  const show = (next: CityView) => {
    store.getState().setView(next);
    if (!onCity) router.push(`/${query}`);
  };

  return (
    <nav className="tabs" aria-label={m.header.viewsLabel}>
      <button type="button" className="tab" aria-pressed={onCity && view === 'city'} onClick={() => show('city')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5" />
        </svg>
        {m.header.tabCity}
      </button>
      <button type="button" className="tab" aria-pressed={onCity && view === 'hierarchy'} onClick={() => show('hierarchy')}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="2" width="6" height="5" rx="1" />
          <path d="M12 7v5 M4 17v-5h16v5" />
          <rect x="1" y="17" width="6" height="5" rx="1" />
          <rect x="17" y="17" width="6" height="5" rx="1" />
        </svg>
        {m.header.tabHierarchy}
      </button>
    </nav>
  );
}
