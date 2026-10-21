import { AppHeader } from '@/components/AppHeader';
import { loadSnapshot } from '@/data/load';
import { MockDataSource, parseScenario } from '@/data/mock/MockDataSource';
import { StructurePanel } from '@/features/city/panel/StructurePanel';
import { CAMPUS_UNITS } from '@/features/city/model/campus';
import { DISTRICT_IDS } from '@/features/city/model/types';
import { getMessages } from '@/i18n';

export const dynamic = 'force-dynamic';

/** Tiempo máximo para obtener los datos antes de mostrar el aviso de error. */
const SNAPSHOT_TIMEOUT_MS = 5_000;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pad2 = (n: number) => String(n).padStart(2, '0');

export default async function Home({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const m = getMessages();
  // `?szenario=` solo tiene sentido mientras la fuente es el simulador (en B1 se limitará a él).
  const scenario = parseScenario((await searchParams).szenario);
  const result = await loadSnapshot(new MockDataSource({ scenario }), { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) });

  return (
    <>
      <AppHeader m={m} current="city" />
      <main className="app-main">
        <section id="ciudad" className="stage" aria-label={m.scene.label}>
          <div className="scene-title">
            <div className="eyebrow">{m.scene.eyebrow}</div>
            <h1>
              {m.scene.titleLine1}
              <br />
              {m.scene.titleLine2}
            </h1>
            <p>
              {m.scene.subtitle} <span>{m.scene.subtitleStrong}</span>
            </p>
          </div>
          <div className="scene-index">
            <strong>{pad2(DISTRICT_IDS.length)} / {pad2(CAMPUS_UNITS.length)}</strong>
            <br />
            {m.scene.indexLabel}
          </div>
          <div className="stage-placeholder">{m.scene.placeholder}</div>
        </section>
        <aside id="estructura" className="aside">
          <StructurePanel m={m} result={result} scenario={scenario} />
        </aside>
      </main>
    </>
  );
}
