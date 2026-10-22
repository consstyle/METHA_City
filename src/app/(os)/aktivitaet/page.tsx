import { ActivityModule } from '@/features/activity/ActivityModule';
import { getMessages } from '@/i18n';
import { PageProjects } from '../PageProjects';
import type { SearchParams } from '../pageSnapshot';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.activity} · METHACity` };

/** Módulo «Aktivität» (Activity de NEXORA): registro filtrable y comunicación entre agentes. */
export default function ActivityPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  return (
    <>
      <PageProjects searchParams={searchParams} />
      <ActivityModule m={getMessages()} />
    </>
  );
}
