import type { Messages } from '@/i18n';
import { ViewTabs } from './ViewTabs';

/** Cabecera de preview.html: marca, edición, pestañas de vista y marca de concepto. */
export function AppHeader({ m }: Readonly<{ m: Messages }>) {
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
      <ViewTabs m={m} />
      <div className="concept">
        <i />
        {m.header.concept}
      </div>
    </header>
  );
}
