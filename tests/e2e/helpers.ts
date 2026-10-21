import { expect, type Page } from '@playwright/test';

export interface CityDiagnosticsState {
  selected: string;
  view: string;
  options: Record<'auto' | 'links' | 'tags' | 'day', boolean>;
  camera: { yaw: number; pitch: number; zoom: number; target: number[]; topView: boolean; focus: string | null };
}

/** Abre la página y espera a que la escena 3D haya dibujado sus primeros fotogramas. */
export async function openCity(page: Page, path = '/') {
  await page.goto(path);
  await page.waitForSelector('html[data-city-ready="true"]', { timeout: 45_000 });
}

export const cityState = (page: Page) =>
  page.evaluate(() => window.__methacity?.getState() as unknown) as Promise<CityDiagnosticsState>;

export async function screenPositionOf(page: Page, unitId: string) {
  const p = await page.evaluate((id) => window.__methacity?.unitScreenPosition(id) ?? null, unitId);
  expect(p, `posición de ${unitId}`).not.toBeNull();
  return p as { x: number; y: number };
}
