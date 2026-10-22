import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { cityState, openCity, screenPositionOf } from './helpers';

test.describe('F2 · escena 3D', () => {
  test('la escena se dibuja con contenido, en alemán y dentro del presupuesto de rendimiento', async ({ page }) => {
    await openCity(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    const shot = await page.locator('.scene-canvas canvas').screenshot();
    expect(shot.byteLength, 'un lienzo vacío pesaría muy poco').toBeGreaterThan(30_000);
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => window.__methacity?.renderInfo());
    expect(info?.calls).toBeGreaterThan(20);
    expect(info?.calls).toBeLessThanOrEqual(200);
    expect(info?.triangles).toBeLessThanOrEqual(400_000);
  });

  test('un clic en un edificio lo selecciona en la escena y en el panel', async ({ page }) => {
    await openCity(page);
    expect((await cityState(page)).selected).toBe('avor');
    for (const id of ['planer', 'werkhof', 'schlosserei']) {
      const p = await screenPositionOf(page, id);
      await page.mouse.click(p.x, p.y);
      await expect.poll(async () => (await cityState(page)).selected).toBe(id);
      await expect(page.locator(`[data-unit="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('F5c · cada proyecto es una obra fuera de la isla: clic, ficha con su equipo y enfoque', async ({ page }) => {
    await openCity(page);
    await expect(page.locator('.label.site')).toHaveCount(3);
    const id = 'projekt:mock-DEV-002';
    const p = await screenPositionOf(page, id);
    await page.mouse.click(p.x, p.y);
    await expect.poll(async () => (await cityState(page)).selected).toBe(id);
    const aside = page.locator('#estructura');
    await expect(aside.getByRole('heading', { level: 2 })).toHaveText('Innloc AG, Rothenburg');
    await expect(aside.getByText('PROJEKTLEITUNG', { exact: false }).first()).toBeVisible();
    await expect(aside.locator(`[data-site="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(aside.locator('a[href="/chat?agent=bl-dev-002"]')).toBeVisible();
    await aside.getByRole('button', { name: 'Diese Baustelle aus der Nähe ansehen' }).click();
    await expect.poll(async () => (await cityState(page)).camera.focus).toBe(id);
  });

  test('arrastrar gira la cámara y no cambia la selección', async ({ page }) => {
    await openCity(page);
    const p = await screenPositionOf(page, 'planer');
    const before = await cityState(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 120, p.y + 10, { steps: 8 });
    await page.mouse.up();
    const after = await cityState(page);
    expect(after.selected).toBe('avor');
    expect(after.camera.yaw).toBeLessThan(before.camera.yaw - 0.3);
  });

  test('teclado: la cámara responde en el lienzo y el panel selecciona con Intro', async ({ page }) => {
    await openCity(page);
    await page.locator('.scene-canvas canvas').focus();
    const start = (await cityState(page)).camera;
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('+');
    let cam = (await cityState(page)).camera;
    expect(cam.yaw).toBeCloseTo(start.yaw + 0.12, 5);
    expect(cam.pitch).toBeCloseTo(start.pitch + 0.08, 5);
    expect(cam.zoom).toBeCloseTo(1.15, 5);
    await page.keyboard.press('Escape');
    cam = (await cityState(page)).camera;
    expect([cam.yaw, cam.pitch, cam.zoom]).toEqual([start.yaw, start.pitch, 1]);

    await page.locator('[data-unit="werkhof"]').focus();
    await page.keyboard.press('Enter');
    expect((await cityState(page)).selected).toBe('werkhof');
  });

  test('barra de herramientas y controles de cámara', async ({ page }) => {
    await openCity(page);
    await page.getByRole('button', { name: 'Abendlicht' }).click();
    await expect(page.getByRole('button', { name: 'Tageslicht' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Verbindungen' }).click();
    await expect(page.getByRole('button', { name: 'Verbindungen' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Luftansicht' }).click();
    expect((await cityState(page)).camera.pitch).toBeCloseTo(1.42, 5);
    await page.getByRole('button', { name: 'Vergrössern' }).click();
    expect((await cityState(page)).camera.zoom).toBeCloseTo(1.15, 5);
    await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
    const reset = await cityState(page);
    expect([reset.camera.pitch, reset.camera.zoom, reset.camera.topView]).toEqual([0.66, 1, false]);

    await page.getByRole('button', { name: 'Orbit' }).click();
    const yaw0 = (await cityState(page)).camera.yaw;
    await page.waitForTimeout(600);
    expect((await cityState(page)).camera.yaw).toBeGreaterThan(yaw0);
    await page.getByRole('button', { name: 'Orbit' }).click();
    expect((await cityState(page)).options.auto).toBe(false);
  });

  test('«aus der Nähe ansehen» enfoca el edificio seleccionado', async ({ page }) => {
    await openCity(page);
    await page.locator('[data-unit="werkhof"]').click();
    await page.getByRole('button', { name: 'Dieses Gebäude aus der Nähe ansehen' }).click();
    const { camera, extent } = await cityState(page);
    expect(camera.focus).toBe('werkhof');
    // El encuadre base crece con las obras (extent): el enfoque lo compensa para acercarse igual.
    expect(extent).toBeGreaterThan(1);
    expect(camera.zoom).toBeCloseTo(1.85 * extent, 5);
  });

  test('capturas para comparar con preview.html', async ({ page }, info) => {
    await openCity(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath('methacity.png') });
    const preview = process.env.PREVIEW_HTML;
    test.skip(!preview || !fs.existsSync(preview), 'define PREVIEW_HTML con la ruta de preview.html para comparar');
    await page.goto(`file:///${(preview as string).replace(/\\/g, '/')}`);
    await page.waitForSelector('html[data-ready="true"]', { timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath('preview.png') });
  });
});
