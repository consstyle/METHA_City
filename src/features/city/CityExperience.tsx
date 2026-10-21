'use client';

import type { SnapshotResult } from '@/data/load';
import type { MockScenario } from '@/data/mock/scenarios';
import { StructurePanel } from '@/features/city/panel/StructurePanel';
import { CityStoreProvider } from '@/features/city/state/CityStoreProvider';
import type { Messages } from '@/i18n';
import { CityStage } from './CityStage';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
}

/** Escena y panel comparten el mismo estado (selección, cámara, opciones). */
export function CityExperience({ m, result, scenario }: Props) {
  return (
    <CityStoreProvider>
      <main className="app-main">
        <CityStage m={m} />
        <aside id="estructura" className="aside">
          <StructurePanel m={m} result={result} scenario={scenario} />
        </aside>
      </main>
    </CityStoreProvider>
  );
}
