import { expect, test } from '@playwright/test';
import { cityState, openCity } from './helpers';

test('en el móvil la escena, los controles y el panel siguen disponibles', async ({ page }, info) => {
  await openCity(page);
  await expect(page.locator('.scene-canvas canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Orbit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Luftansicht' })).toBeVisible();
  await page.locator('[data-unit="bau"]').scrollIntoViewIfNeeded();
  await page.locator('[data-unit="bau"]').click();
  expect((await cityState(page)).selected).toBe('bau');
  await page.screenshot({ path: info.outputPath('methacity-mobile.png'), fullPage: true });
});
