import { ActivityModule } from '@/features/activity/ActivityModule';
import { getMessages } from '@/i18n';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.activity} · METHACity` };

/** Módulo «Aktivität» (Activity de NEXORA): registro filtrable y comunicación entre agentes. */
export default function ActivityPage() {
  return <ActivityModule m={getMessages()} />;
}
