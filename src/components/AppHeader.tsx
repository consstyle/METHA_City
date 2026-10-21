import type { Messages } from '@/i18n';

type View = 'city' | 'hierarchy';

/** Cabecera de preview.html. Las pestañas se vuelven interactivas en F3. */
export function AppHeader({ m, current }: Readonly<{ m: Messages; current: View }>) {
  return (
    <header className="app-header">
      <div className="brand">
        <span>METHA</span>BAU<small>{m.header.brandSub}</small>
      </div>
      <div className="divider" />
      <div className="edition">
        {m.header.edition} <strong>{m.header.editionNumber}</strong>
        <br />
        {m.header.editionSub}
      </div>
      <nav className="tabs" aria-label={m.header.viewsLabel}>
        <a className="tab" href="#ciudad" aria-current={current === 'city' ? 'true' : undefined}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5" />
          </svg>
          {m.header.tabCity}
        </a>
        <a className="tab" href="#estructura" aria-current={current === 'hierarchy' ? 'true' : undefined}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="2" width="6" height="5" rx="1" />
            <path d="M12 7v5 M4 17v-5h16v5" />
            <rect x="1" y="17" width="6" height="5" rx="1" />
            <rect x="17" y="17" width="6" height="5" rx="1" />
          </svg>
          {m.header.tabHierarchy}
        </a>
      </nav>
      <div className="concept">
        <i />
        {m.header.concept}
      </div>
    </header>
  );
}
