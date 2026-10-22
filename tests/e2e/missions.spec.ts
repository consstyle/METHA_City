import { expect, test, type Page } from '@playwright/test';
import { openCity } from './helpers';

const OBJECTIVE = 'Überfällige Montagen der nächsten zwei Wochen reduzieren';

async function startMission(page: Page, objective = OBJECTIVE) {
  await page.goto('/missionen');
  await page.getByLabel('Ziel', { exact: true }).fill(objective);
  await page.getByLabel('Erwartetes Ergebnis').fill('Liste der Teilsysteme mit Massnahmen');
  await page.getByLabel('Ausführlich').check();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await expect(page).toHaveURL(/\/missionen\/m-/);
}

const chip = (page: Page) => page.locator('.module-head .mission-chip');

test.describe('F5 · Missionen (hito MVP)', () => {
  test.setTimeout(150_000);

  test('misión → aprobar plan → ejecución → aprobar resultado → informe', async ({ page }) => {
    await startMission(page);
    await expect(chip(page)).toHaveText('Wird geplant');
    await expect(chip(page)).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    // Montajes sin nombrar proyecto: trabajan las Bauleitungen de las 2 primeras obras.
    await expect(page.locator('.step')).toHaveCount(4);
    await expect(page.locator('.step').nth(1)).toContainText('Bauleitung DEV-001');

    // La Freigabe del plan aparece en el módulo Freigaben y se decide allí
    await page.locator('.module-rail').getByRole('link', { name: 'Freigaben' }).click();
    await page.getByRole('button', { name: `Genehmigen: Plan für «${OBJECTIVE}»` }).click();
    await expect(page.locator('[data-history="approved"]')).toHaveCount(1);

    // Mientras trabaja, el agente del paso está ocupado en la ciudad con el texto del paso
    await page.locator('.module-rail').getByRole('link', { name: 'Leitstand' }).click();
    await expect(page.locator('[data-agent]').filter({ hasText: 'Überfällige Montagen' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.stat').nth(3)).toContainText('1');

    // Los pasos aparecen solos en el Kanban
    await page.locator('.module-rail').getByRole('link', { name: 'Aufgaben' }).click();
    await expect(page.locator('.task-card.locked').first()).toBeVisible();

    await page.locator('.module-rail').getByRole('link', { name: 'Missionen' }).click();
    await page.locator('.mission-link').first().click();
    await expect(chip(page)).toHaveText('Ergebnis wartet auf Freigabe', { timeout: 60_000 });
    await expect(page.locator('.draft-tag')).toBeVisible();
    await expect(page.locator('.report')).toContainText('Kennzahlen aus MethaDesk');

    await page.getByRole('button', { name: 'Ergebnis genehmigen' }).click();
    await expect(chip(page)).toHaveText('Abgeschlossen');
    await expect(page.locator('#mission-title')).toBeFocused();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Als Markdown herunterladen' }).click();
    // El nombre se acorta a 50 caracteres (reportFileName).
    expect((await download).suggestedFilename()).toBe('bericht-uberfallige-montagen-der-nachsten-zwei-wochen-redu.md');

    // Todo queda en el diario de Aktivität
    await page.locator('.module-rail').getByRole('link', { name: 'Aktivität' }).click();
    await expect(page.locator('[data-feed="mission"]').first()).toBeVisible();
    await page.getByLabel('Suchen').fill('Bericht abgeschlossen');
    await expect(page.locator('[data-feed]')).toHaveCount(1);
  });

  test('rechazar el plan detiene la misión; la ciudad sigue dentro del presupuesto con una misión en marcha', async ({ page }) => {
    await startMission(page, 'Materialbestellung für das Vordach klären');
    await expect(chip(page)).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Plan ablehnen' }).click();
    await expect(chip(page)).toHaveText('Abgelehnt');
    await expect(page.getByRole('button', { name: 'Mission abbrechen' })).toHaveCount(0);

    await startMission(page, 'Fertigung in der Schlosserei beschleunigen');
    await expect(chip(page)).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Plan genehmigen' }).click();
    await openCity(page);
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => window.__methacity?.renderInfo());
    expect(info?.calls).toBeLessThanOrEqual(200);
  });

  test('cancelar una misión en marcha libera al agente y deja el paso en «Offen»', async ({ page }) => {
    await startMission(page, 'Lager und Versand für die Woche planen');
    await expect(chip(page)).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Plan genehmigen' }).click();
    await expect(page.locator('.step.working')).toHaveCount(1);
    await page.getByRole('button', { name: 'Mission abbrechen' }).click();
    await expect(chip(page)).toHaveText('Abgebrochen');
    await expect(page.locator('.step.working')).toHaveCount(0);
    await expect(page.locator('p[role="status"]').filter({ hasText: 'abgebrochen' })).toHaveCount(1);
  });

  test('una misión sigue donde iba tras recargar', async ({ page }) => {
    await startMission(page, 'Projektbericht für die Woche erstellen');
    await expect(chip(page)).toHaveText('Plan wartet auf Freigabe', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Plan genehmigen' }).click();
    await expect(chip(page)).toHaveText('Läuft');
    await page.reload();
    await expect(chip(page)).toHaveText(/Läuft|Ergebnis wartet auf Freigabe/);
    await expect(page.locator('.step.done').first()).toBeVisible();
  });

  test('ids de misión inválidos dan 404 y uno inexistente avisa', async ({ page }) => {
    expect((await page.goto('/missionen/<script>'))?.status()).toBe(404);
    await page.goto('/missionen/m-abc-1');
    await expect(page.locator('.notice[role="alert"]')).toContainText('gibt es nicht');
  });
});

test.describe('F5 · Aufgaben', () => {
  test('crear, mover con flechas y arrastrando, borrar y persistir', async ({ page }) => {
    await page.goto('/aufgaben');
    await page.getByLabel('Aufgabe', { exact: true }).fill('Lieferschein für Teilsystem 12 prüfen');
    await page.getByLabel('Zuständig').selectOption('werkhof');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    const card = page.locator('[data-column="offen"] .task-card').first();
    await expect(card).toContainText('Werkhof');
    await expect(page.getByLabel('Aufgabe', { exact: true })).toBeFocused();

    await card.getByRole('button', { name: /nach «In Arbeit» verschieben/ }).click();
    await expect(page.locator('[data-column="in-arbeit"] .task-card')).toHaveCount(1);
    await expect(page.locator('[data-column="in-arbeit"] [data-dir="right"]')).toBeFocused();
    await expect(page.locator('p[role="status"]').filter({ hasText: 'jetzt «In Arbeit»' })).toHaveCount(1);

    await page.locator('[data-column="in-arbeit"] .task-card').dragTo(page.locator('[data-column="erledigt"]'));
    await expect(page.locator('[data-column="erledigt"] .task-card')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-column="erledigt"] .task-card')).toContainText('Lieferschein');
    await page.getByRole('button', { name: /Lieferschein für Teilsystem 12 prüfen löschen/ }).click();
    await expect(page.locator('.task-card')).toHaveCount(0);
    await expect(page.locator('#col-erledigt')).toBeFocused();
    await expect(page.locator('p[role="status"]').filter({ hasText: 'gelöscht' })).toHaveCount(1);
  });
});
