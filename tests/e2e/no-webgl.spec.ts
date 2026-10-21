import { expect, test } from '@playwright/test';

test('sin WebGL se avisa y el panel sigue funcionando', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('benötigt WebGL');
  await expect(page.locator('.scene-canvas canvas')).toHaveCount(0);
  await page.locator('[data-unit="bauleitung"]').click();
  await expect(page.locator('[data-unit="bauleitung"]')).toHaveAttribute('aria-pressed', 'true');
});
