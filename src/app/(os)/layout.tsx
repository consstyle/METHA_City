import { AppHeader } from '@/components/AppHeader';
import { ModuleRail } from '@/components/ModuleRail';
import { CityStoreProvider } from '@/features/city/state/CityStoreProvider';
import { getMessages } from '@/i18n';
import { OsProvider } from '@/os/OsProvider';
import '../os.css';
import '../modules.css';

/** Armazón del sistema operativo: cabecera, barra de módulos y estado compartido entre módulos. */
export default function OsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const m = getMessages();
  return (
    <CityStoreProvider>
      <OsProvider>
        <AppHeader m={m} />
        <div className="os-body">
          <ModuleRail m={m} />
          <div className="os-content">{children}</div>
        </div>
      </OsProvider>
    </CityStoreProvider>
  );
}
