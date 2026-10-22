import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openCity } from './helpers';

/** Criterio de aceptación de F3: axe sin fallos graves (serious/critical) en los módulos del MVP. */
async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.scene-canvas').analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

test.describe('F3 · accesibilidad', () => {
  test('Stadt', async ({ page }) => {
    await openCity(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('Hierarchie', async ({ page }) => {
    await openCity(page);
    await page.getByRole('button', { name: 'Hierarchie' }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('Leitstand', async ({ page }) => {
    await page.goto('/leitstand');
    await expect(page.locator('[data-agent]')).toHaveCount(9);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('Agenten (con una Freigabe pendiente)', async ({ page }) => {
    await page.goto('/agenten');
    await expect(page.locator('[data-agent-card]')).toHaveCount(9);
    await page.getByRole('button', { name: 'IT-Support anfordern' }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('Perfil', async ({ page }) => {
    await page.goto('/agenten/chief');
    await expect(page.locator('#profile-title')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('Missionen, Freigaben, Aufgaben y Aktivität (con una misión en espera)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/missionen');
    await page.getByLabel('Ziel', { exact: true }).fill('Überfällige Montagen reduzieren');
    await page.getByRole('button', { name: 'Mission starten' }).click();
    await expect(page.locator('.module-head .mission-chip')).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    expect(await seriousViolations(page), 'detalle de misión').toEqual([]);
    for (const path of ['/missionen', '/freigaben', '/aufgaben', '/aktivitaet']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForTimeout(300);
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });

  test('Chat (con una respuesta)', async ({ page }) => {
    await page.goto('/chat?agent=bau');
    await page.getByRole('textbox', { name: 'Nachricht' }).fill('Hallo');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.locator('.bubble[data-role="agent"]')).toHaveCount(1, { timeout: 15_000 });
    expect(await seriousViolations(page)).toEqual([]);
  });
});
