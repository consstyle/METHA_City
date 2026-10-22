import { expect, test } from '@playwright/test';
import { cityState, openCity } from './helpers';

const visibleLabels = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-label]')].filter((e) => e.style.display !== 'none').map((e) => e.dataset.label),
  );

test.describe('F3 · sistema y ciudad viva', () => {
  test('las etiquetas muestran los 8 edificios y un clic en una etiqueta selecciona', async ({ page }) => {
    await openCity(page);
    await expect.poll(async () => (await visibleLabels(page)).length).toBe(8);
    await page.locator('[data-label="blech"]').click();
    await expect.poll(async () => (await cityState(page)).selected).toBe('blech');
    await expect(page.locator('.panel-hero h2')).toHaveText('Blechabteilung');
    await expect(page.locator('[data-unit="blech"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('«Namen» oculta y vuelve a mostrar las etiquetas', async ({ page }) => {
    await openCity(page);
    const namen = page.getByRole('button', { name: 'Namen' });
    await expect(namen).toHaveAttribute('aria-pressed', 'true');
    await namen.click();
    await expect(namen).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.labels-layer')).toBeHidden();
    await namen.click();
    await expect(page.locator('.labels-layer')).toBeVisible();
  });

  test('la vista «Hierarchie» selecciona desde el organigrama y oculta los controles 3D', async ({ page }) => {
    await openCity(page);
    await page.getByRole('button', { name: 'Hierarchie' }).click();
    await expect(page.locator('[data-org]')).toHaveCount(8);
    await expect(page.locator('.toolbar')).toHaveCount(0);
    await expect(page.locator('.labels-layer')).toBeHidden();
    await page.locator('[data-org="einkauf"]').click();
    await expect(page.locator('[data-org="einkauf"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.panel-hero h2')).toHaveText('Einkauf');
    await page.getByRole('button', { name: '3D-Stadt' }).click();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('el panel muestra el agente simulado y el resumen del Leitstand', async ({ page }) => {
    await openCity(page);
    await expect(page.locator('.cockpit-summary')).toContainText(/von 9/);
    await expect(page.locator('#agent-title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chat öffnen' })).toBeDisabled();
  });

  test('carril: Stadt ↔ Leitstand con agentes, actividad y estado del sistema', async ({ page }) => {
    await openCity(page);
    await page.locator('.module-rail').getByRole('link', { name: 'Leitstand' }).click();
    await expect(page).toHaveURL(/\/leitstand$/);
    await expect(page.locator('.module-rail [aria-current="page"]')).toHaveText('Leitstand');
    await expect(page.locator('[data-agent]')).toHaveCount(9);
    await expect(page.locator('.stat')).toHaveCount(5);
    await expect(page.locator('[data-service="hermes"]')).toContainText('Nicht verbunden');
    await expect(page.locator('.module-rail .rail-item.disabled')).toHaveCount(6);

    const firstEvent = () => page.locator('.feed-item .feed-text').first().textContent();
    const before = await firstEvent();
    await expect.poll(firstEvent, { timeout: 15_000 }).not.toBe(before);

    await page.locator('[data-agent="werkhof"] .link-btn').click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForSelector('html[data-city-ready="true"]', { timeout: 45_000 });
    await expect.poll(async () => (await cityState(page))?.selected).toBe('werkhof');
  });

  test('cada etiqueta queda encima de su edificio, con la línea guía saliendo de su borde inferior', async ({ page }) => {
    await openCity(page);
    await expect.poll(async () => (await visibleLabels(page)).length).toBe(8);
    await page.waitForTimeout(700);
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-label]')].map((el) => {
        const r = el.getBoundingClientRect();
        const stage = document.querySelector('.stage')!.getBoundingClientRect();
        return { id: el.dataset.label, cx: r.left + r.width / 2 - stage.left, bottom: r.bottom - stage.top, left: parseFloat(el.style.left), top: parseFloat(el.style.top), inStage: r.left >= stage.left && r.right <= stage.right };
      }),
    );
    for (const b of boxes) {
      expect(Math.abs(b.cx - b.left), `${b.id}: centrada en su x`).toBeLessThan(1.5);
      expect(Math.abs(b.bottom - b.top), `${b.id}: borde inferior en su y`).toBeLessThan(1.5);
      expect(b.inStage, `${b.id}: dentro del escenario`).toBe(true);
    }
  });

  test('el escenario del simulador se conserva al cambiar de módulo', async ({ page }) => {
    await openCity(page, '/?szenario=fehler');
    await page.locator('.module-rail').getByRole('link', { name: 'Leitstand' }).click();
    await expect(page).toHaveURL(/\/leitstand\?szenario=fehler$/);
    await expect(page.locator('.methadesk-card [role="alert"]')).toBeVisible();
    await page.getByRole('button', { name: '3D-Stadt' }).click();
    await expect(page).toHaveURL(/\/\?szenario=fehler$/);
  });

  test('el Leitstand avisa cuando MethaDesk falla, sin romper el resto', async ({ page }) => {
    await page.goto('/leitstand?szenario=fehler');
    await expect(page.locator('.methadesk-card [role="alert"]')).toBeVisible();
    await expect(page.locator('[data-agent]')).toHaveCount(9);
  });
});
