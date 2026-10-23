import { expect, test } from '@playwright/test';
import { openCity } from './helpers';

const flow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({ emitted: window.__methacityFlow?.emitted() ?? 0, active: window.__methacityFlow?.active() ?? [] }));

test.describe('Flujo de Teilsysteme en la ciudad', () => {
  test('los TS circulan de un edificio a otro, con etiqueta y en el panel, dentro del presupuesto', async ({ page }, info) => {
    await openCity(page);
    await expect.poll(async () => (await flow(page)).emitted, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    const { active } = await flow(page);
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(['plan', 'zuteilung', 'bereit', 'fertig']).toContain(active[0]!.kind);

    await expect(page.locator('.tstag:visible').first()).toHaveText(/^TS \d+$/, { timeout: 10_000 });
    await expect(page.locator('[data-ts]').first()).toContainText(/TS \d+/);
    await expect(page.locator('[data-ts]').first()).toContainText('→');

    const info3d = await page.evaluate(() => window.__methacity?.renderInfo());
    expect(info3d?.calls).toBeLessThanOrEqual(200);
    await page.screenshot({ path: info.outputPath('ts-flow.png') });
  });

  test('ir al Leitstand y volver: el feed sigue, sin TS repetidos ni avisos de React', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => { if (/same key|duplicate/i.test(msg.text())) warnings.push(msg.text()); });
    await openCity(page);
    await expect.poll(async () => (await flow(page)).emitted, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await page.locator('.module-rail').getByRole('link', { name: 'Leitstand' }).click();
    await expect(page).toHaveURL(/leitstand/, { timeout: 15_000 }); // con WebGL por software el hilo principal va lento
    await page.locator('.module-rail').getByRole('link', { name: 'Stadt' }).click();
    await page.waitForSelector('html[data-city-ready="true"]', { timeout: 45_000 });
    await expect.poll(async () => (await flow(page)).emitted, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    const rows = await page.locator('[data-ts]').allInnerTexts();
    const keys = rows.map((r) => r.replace(/\s+/g, ' '));
    expect(new Set(keys).size, `filas repetidas: ${keys.join(' | ')}`).toBe(keys.length);
    expect(warnings).toEqual([]);
  });

  test('tras pasar por Hierarchie nunca hay dos camiones con el mismo TS', async ({ page }) => {
    // Casi 30 s de esperas fijas a propósito, más los clics con WebGL por software.
    test.slow();
    await openCity(page);
    await expect.poll(async () => (await flow(page)).active.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: 'Hierarchie' }).click();
    await page.waitForTimeout(18_000); // más que el descanso de un TS (16 s)
    await page.getByRole('button', { name: '3D-Stadt' }).click();
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(1_500);
      const nrs = (await flow(page)).active.map((a) => a.nr);
      expect(new Set(nrs).size, `TS repetidos en la calle: ${nrs.join(', ')}`).toBe(nrs.length);
    }
  });

  test('con «menos movimiento» el flujo empieza apagado y se puede encender', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openCity(page);
    const toggle = page.getByRole('button', { name: 'TS-Fluss' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('«TS-Fluss» einschalten')).toBeVisible();
    await toggle.click();
    await expect.poll(async () => (await flow(page)).emitted, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  });

  test('«TS-Fluss» los oculta y deja de enviar; al volver a encenderlo siguen saliendo', async ({ page }) => {
    await openCity(page);
    const toggle = page.getByRole('button', { name: 'TS-Fluss' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.tstag:visible')).toHaveCount(0);
    const before = (await flow(page)).emitted;
    await page.waitForTimeout(5_000);
    expect((await flow(page)).emitted).toBe(before);
    await toggle.click();
    await expect.poll(async () => (await flow(page)).emitted, { timeout: 15_000 }).toBeGreaterThan(before);
  });
});
