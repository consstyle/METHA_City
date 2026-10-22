import { expect, test } from '@playwright/test';
import { cityState, openCity } from './helpers';

test('en el móvil la escena, los controles y el panel siguen disponibles', async ({ page }, info) => {
  await openCity(page);
  await expect(page.locator('.scene-canvas canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Orbit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Luftansicht' })).toBeVisible();
  await expect(page.locator('.module-rail').getByRole('link', { name: 'Leitstand' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, 'sin desplazamiento horizontal').toBe(false);
  await page.locator('[data-unit="bau"]').scrollIntoViewIfNeeded();
  await page.locator('[data-unit="bau"]').click();
  expect((await cityState(page)).selected).toBe('bau');
  await page.screenshot({ path: info.outputPath('methacity-mobile.png'), fullPage: true });
});

test('en el móvil el Leitstand cabe en la pantalla', async ({ page }, info) => {
  await page.goto('/leitstand');
  await expect(page.locator('[data-agent]')).toHaveCount(9);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, 'sin desplazamiento horizontal').toBe(false);
  await page.screenshot({ path: info.outputPath('leitstand-mobile.png'), fullPage: true });
});
