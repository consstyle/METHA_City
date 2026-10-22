import { expect, test } from '@playwright/test';
import { openCity } from './helpers';

test.describe('F4 · Chat', () => {
  test('conversación con la Bauleitung de una obra: streaming, números de su proyecto y persistencia', async ({ page }) => {
    await page.goto('/chat?agent=bl-dev-001');
    const input = page.getByRole('textbox', { name: 'Nachricht' });
    await expect(input).toBeEnabled();
    await input.fill('Wie stehen die Zahlen in MethaDesk?');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: 'Stopp' })).toBeVisible();
    const reply = page.locator('.bubble[data-role="agent"]');
    await expect(reply).toContainText('Im Projekt DEV-001 sind', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Senden' })).toBeVisible();
    await expect(page.locator('[data-conversation="bl-dev-001"]')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('.bubble[data-role="user"]')).toHaveText(/Wie stehen die Zahlen/);
    await expect(page.locator('.bubble[data-role="agent"]')).toHaveCount(1);
  });

  test('«Stopp» corta la respuesta y la marca como abgebrochen', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('#chat-agent')).toHaveValue('chief');
    const input = page.getByRole('textbox', { name: 'Nachricht' });
    await input.fill('Hallo! Was kannst du, woran arbeitest du, wie sind die Zahlen und übernimm bitte einen Auftrag.');
    await page.getByRole('button', { name: 'Senden' }).click();
    await page.getByRole('button', { name: 'Stopp' }).click();
    await expect(page.locator('.bubble.agent.stopped')).toContainText('Abgebrochen');
    await expect(input).toBeFocused();
  });

  test('adjuntos: se muestran nombre y tamaño y el agente los menciona sin leerlos', async ({ page }) => {
    await page.goto('/chat?agent=werkhof');
    await page.locator('input[type="file"]').setInputFiles({ name: 'lieferschein.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(page.locator('.chip')).toContainText('lieferschein.pdf');
    await expect(page.getByText('Anhänge werden nicht hochgeladen')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nachricht' }).fill('Hier der Lieferschein');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.locator('.bubble[data-role="agent"]')).toContainText('1 Anhang/Anhänge (lieferschein.pdf)', { timeout: 15_000 });
  });

  test('desde el panel de la ciudad se abre el chat del agente; un especialista sin contratar no se puede escribir', async ({ page }) => {
    await openCity(page);
    await page.locator('.panel-section').getByRole('link', { name: 'Chat öffnen' }).click();
    await expect(page).toHaveURL(/\/chat\?agent=avor$/);
    await expect(page.locator('#chat-agent')).toHaveValue('avor');

    await page.goto('/chat?agent=bim');
    await expect(page.locator('.notice[role="alert"]')).toContainText('nicht mehr im Einsatz');
    await expect(page.getByRole('textbox', { name: 'Nachricht' })).toBeDisabled();
  });

  test('el agente mostrado siempre es el de la conversación abierta (también al volver por el carril)', async ({ page }) => {
    await page.goto('/chat');
    const input = page.getByRole('textbox', { name: 'Nachricht' });
    await input.fill('Hallo');
    await input.press('Enter');
    await expect(page.locator('.bubble[data-role="agent"]')).toContainText('Methabau Chief', { timeout: 15_000 });

    await page.locator('#chat-agent').selectOption('planer');
    await expect(page).toHaveURL(/agent=planer/);
    await page.getByRole('button', { name: '+ Neue Unterhaltung' }).click();
    await page.locator('.module-rail').getByRole('link', { name: 'Chat' }).click();
    await expect(page.locator('#chat-agent')).toHaveValue('chief');
    await expect(page.locator('.chat-main-head')).toHaveText('Methabau Chief');

    await page.locator('[data-conversation="chief"] .conversation-open').click();
    await expect(page).toHaveURL(/agent=chief/);
  });

  test('Mayús+Intro salta de línea, Intro envía y el foco se queda en la caja', async ({ page }) => {
    await page.goto('/chat?agent=bau');
    const input = page.getByRole('textbox', { name: 'Nachricht' });
    await input.click();
    await page.keyboard.type('Zeile 1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Zeile 2');
    await expect(input).toHaveValue('Zeile 1\nZeile 2');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(page.locator('.bubble[data-role="user"]')).toHaveText(/Zeile 1\s+Zeile 2/);
  });
});
