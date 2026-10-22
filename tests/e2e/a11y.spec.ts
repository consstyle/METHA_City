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
});
