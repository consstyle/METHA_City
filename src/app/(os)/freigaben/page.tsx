import { ApprovalsModule } from '@/features/approvals/ApprovalsModule';
import { getMessages } from '@/i18n';

// Como los demás módulos: el armazón lee `?szenario=` (useSearchParams) y no se prerenderiza.
export const dynamic = 'force-dynamic';

export const metadata = { title: `${getMessages().nav.approvals} · METHACity` };

/** Módulo «Freigaben» (Approvals de NEXORA). */
export default function ApprovalsPage() {
  return <ApprovalsModule m={getMessages()} />;
}
