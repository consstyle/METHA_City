import { expect, test, type Page } from '@playwright/test';
import { openCity } from './helpers';

const pavilions = (page: Page) => page.evaluate(() => window.__methacity?.pavilions() ?? null);

async function openDirectory(page: Page) {
  await page.goto('/agenten');
  await expect(page.locator('[data-agent-card]')).toHaveCount(9);
}

test.describe('F4 · Agenten', () => {
  test('directorio: Chief, 8 unidades, filtros y catálogo de 14 especialistas', async ({ page }) => {
    await openDirectory(page);
    await expect(page.locator('[data-agent-card]').first()).toHaveAttribute('data-agent-card', 'chief');
    await expect(page.locator('[data-role]')).toHaveCount(14);
    await page.getByRole('button', { name: 'Spezialisten', exact: true }).click();
    await expect(page.locator('[data-agent-card]')).toHaveCount(0);
    await expect(page.getByText('Noch keine Spezialisten im Einsatz')).toBeVisible();
    await page.getByRole('button', { name: 'Einheiten', exact: true }).click();
    await expect(page.locator('[data-agent-card]')).toHaveCount(9);
  });

  test('contratar con Freigabe: el pabellón aparece en la ciudad y el agente trabaja; retirar lo quita', async ({ page }) => {
    await openDirectory(page);
    await page.getByRole('button', { name: 'BIM-Koordination anfordern' }).click();
    await expect(page.locator('[data-role="bim"]')).toContainText('Freigabe ausstehend');
    await expect(page.locator('.approvals-card .count-badge')).toHaveText('1');

    // La Freigabe pendiente cuenta en el Leitstand
    await page.locator('.module-rail').getByRole('link', { name: 'Leitstand' }).click();
    await expect(page.locator('.stat').nth(2)).not.toContainText('—');
    const pendingCount = Number((await page.locator('.stat-value').nth(2).textContent()) ?? '0');
    expect(pendingCount).toBeGreaterThanOrEqual(1);

    await page.locator('.module-rail').getByRole('link', { name: 'Stadt' }).click();
    await page.waitForSelector('html[data-city-ready="true"]', { timeout: 45_000 });
    await expect.poll(() => pavilions(page)).toEqual([{ role: 'bim', pending: true }]);

    await page.locator('.module-rail').getByRole('link', { name: 'Freigaben' }).click();
    await page.getByRole('button', { name: /Genehmigen: BIM-Koordination einstellen/ }).click();
    await page.locator('.module-rail').getByRole('link', { name: 'Agenten' }).click();
    await expect(page.locator('[data-agent-card="bim"]')).toBeVisible();
    await expect(page.locator('[data-agent-card="bim"]')).toContainText('Für Projektleitung');

    await openCity(page);
    await expect.poll(() => pavilions(page)).toEqual([{ role: 'bim', pending: false }]);
    const info = await page.evaluate(() => window.__methacity?.renderInfo());
    expect(info?.calls).toBeLessThanOrEqual(200);

    await page.goto('/agenten');
    await page.getByRole('button', { name: 'BIM-Koordination zurückziehen' }).click();
    await page.goto('/freigaben');
    await page.getByRole('button', { name: /Genehmigen: BIM-Koordination zurückziehen/ }).click();
    await page.goto('/agenten');
    await expect(page.locator('[data-agent-card]')).toHaveCount(9);
    await expect(page.locator('[data-agent-card="bim"]')).toHaveCount(0);
    await openCity(page);
    await expect.poll(() => pavilions(page)).toEqual([]);
  });

  test('rechazar libera el solar; sin solar libre no se puede contratar', async ({ page }) => {
    await openDirectory(page);
    for (const name of ['Kalkulation & Offerten', 'Terminplanung', 'BIM-Koordination', 'Recht & Verträge']) {
      await page.getByRole('button', { name: `${name} anfordern` }).click();
    }
    await expect(page.locator('[data-role="kundendienst"]')).toContainText('Kein Bauplatz frei');
    await expect(page.getByRole('button', { name: 'Personal anfordern' })).toBeEnabled();
    await page.goto('/freigaben');
    await page.getByRole('button', { name: /Ablehnen: Recht & Verträge einstellen/ }).click();
    await page.goto('/agenten');
    await expect(page.getByRole('button', { name: 'Kundendienst anfordern' })).toBeVisible();
  });

  test('perfil: responsabilidades, instrucciones guardadas tras recargar, historial y aviso si no existe', async ({ page }) => {
    await page.goto('/agenten/bauleitung');
    await expect(page.getByRole('heading', { level: 1, name: 'Bauleitung' })).toBeVisible();
    await expect(page.locator('.bullet-list').first()).toContainText('Leitet die Baustellen');
    const box = page.getByRole('textbox', { name: /Ständige Anweisungen/ });
    await box.fill('Immer zuerst die Abrufe prüfen.');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: /Ständige Anweisungen/ })).toHaveValue('Immer zuerst die Abrufe prüfen.');
    await expect(page.locator('.file-list li')).toHaveCount(2);

    await page.goto('/agenten/bim');
    await expect(page.locator('.notice[role="alert"]')).toContainText('nicht mehr im Einsatz');
    const res = await page.goto('/agenten/nope');
    expect(res?.status()).toBe(404);
  });

  test('tras una decisión el foco vuelve al título de la tarjeta y se anuncia', async ({ page }) => {
    await openDirectory(page);
    await page.getByRole('button', { name: 'IT-Support anfordern' }).click();
    await expect(page.locator('#catalog-title')).toBeFocused();
    await expect(page.locator('p[role="status"]').filter({ hasText: 'Freigabe angefordert' })).toHaveCount(1);
    await page.goto('/freigaben');
    await page.getByRole('button', { name: /Genehmigen: IT-Support einstellen/ }).click();
    await expect(page.locator('#pending-title')).toBeFocused();
    await expect(page.locator('p[role="status"]').filter({ hasText: 'Genehmigt: IT-Support einstellen' })).toHaveCount(1);
    await expect(page.locator('[data-history="approved"]')).toHaveCount(1);
  });

  test('con los 8 solares ocupados la ciudad sigue dentro del presupuesto de dibujo', async ({ page }) => {
    const at = '2026-10-22T08:00:00.000Z';
    const roles = [['qualitaet', 'i1'], ['controlling', 'i2'], ['personal', 'i3'], ['lieferanten', 'i4'], ['kalkulation', 'p1'], ['terminplanung', 'p2'], ['bim', 'p3'], ['recht', 'p4']];
    const state = { hires: roles.map(([roleId, lotId]) => ({ roleId, lotId, status: 'active', requestedAt: at })), approvals: [] };
    await page.addInitScript((value) => window.localStorage.setItem('methacity.hiring.v1', value), JSON.stringify(state));
    await openCity(page);
    await expect.poll(async () => (await pavilions(page))?.length).toBe(8);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => window.__methacity?.renderInfo());
    expect(info?.calls).toBeLessThanOrEqual(200);
  });

  test('datos guardados corruptos o tocados: la app arranca limpia y sin errores', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('methacity.hiring.v1', JSON.stringify({ hires: [{ roleId: 'bim', lotId: 'i1', status: 'active', requestedAt: '2026-10-22T08:00:00.000Z' }], approvals: [] }));
      window.localStorage.setItem('methacity.chat.v1', '{kaputt');
      window.localStorage.setItem('methacity.agents.v1', JSON.stringify({ instructions: { bau: 42 } }));
    });
    await openDirectory(page);
    await expect(page.locator('[data-role="bim"] button')).toHaveText('Anfordern');
    await page.goto('/chat');
    await expect(page.getByText('Noch keine Unterhaltungen.')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
