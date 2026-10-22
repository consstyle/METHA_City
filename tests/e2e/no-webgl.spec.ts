import { expect, test } from '@playwright/test';

test('sin WebGL se avisa y el panel sigue funcionando', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('benötigt WebGL');
  await expect(page.locator('.scene-canvas canvas')).toHaveCount(0);
  await page.locator('[data-unit="bauleitung"]').click();
  await expect(page.locator('[data-unit="bauleitung"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.labels-layer')).toHaveCount(0);
});

test('sin WebGL el Leitstand funciona igual', async ({ page }) => {
  await page.goto('/leitstand');
  await expect(page.locator('[data-agent]')).toHaveCount(9);
});
