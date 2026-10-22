'use client';

import type { SnapshotResult } from '@/data/load';
import type { MockScenario } from '@/data/mock/scenarios';
import { UnitPanel } from '@/features/city/panel/UnitPanel';
import type { Messages } from '@/i18n';
import { CityStage } from './CityStage';

interface Props {
  readonly m: Messages;
  readonly result: SnapshotResult;
  readonly scenario: MockScenario;
}

/** Escena y panel comparten el mismo estado (selección, cámara, opciones), creado en el layout. */
export function CityExperience({ m, result, scenario }: Props) {
  return (
    <main className="app-main">
      <CityStage m={m} />
      <aside id="estructura" className="aside">
        <UnitPanel m={m} result={result} scenario={scenario} />
      </aside>
    </main>
  );
}
