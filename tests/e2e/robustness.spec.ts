import { test, expect, type Page } from '@playwright/test';
import { start, press, type, chip, cell, option, openMode, expectResult, expectError } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

async function fill(page: Page, ...values: string[]): Promise<void> {
  for (const v of values) await type(page, `${v}=`);
}

test('lange Eingaben scrollen, der Cursor bleibt sichtbar', async ({ page }) => {
  await type(page, '123456789+123456789+123456789+123456789+123456789');
  const entry = (await page.getByTestId('entry').boundingBox())!;
  const cursor = (await page.locator('.m-cursor').boundingBox())!;
  expect(cursor.x).toBeGreaterThanOrEqual(entry.x);
  expect(cursor.x).toBeLessThanOrEqual(entry.x + entry.width);
  await press(page, 'exe');
  await expectResult(page, '617283945');
  // sehr große und sehr kleine Ergebnisse passen in die Anzeige
  await press(page, 'ac', '9', 'pow', '9', '9', 'exe');
  await expectResult(page, '2,951266543×10⁹⁴');
  const display = (await page.getByTestId('display').boundingBox())!;
  const result = (await page.getByTestId('result').boundingBox())!;
  expect(result.x).toBeGreaterThanOrEqual(display.x);
  expect(result.x + result.width).toBeLessThanOrEqual(display.x + display.width);
});

test('tief verschachtelte Formeln bleiben im Display', async ({ page }) => {
  // 1 + 1/(1 + 1/(1 + 1/2))
  await press(page, '1', 'add', 'frac', '1', 'down', '1', 'add', 'frac', '1', 'down', '1', 'add', 'frac', '1', 'down', '2', 'exe');
  await expectResult(page, '8/5');
  const display = (await page.getByTestId('display').boundingBox())!;
  const entry = (await page.getByTestId('entry').boundingBox())!;
  expect(entry.y).toBeGreaterThanOrEqual(display.y);
  expect(entry.y + entry.height).toBeLessThanOrEqual(display.y + display.height + 0.5);
  await press(page, 'ac', 'sqrt', 'sqrt', 'sqrt', '2', '5', '6', 'exe');
  await expectResult(page, '2');
});

test('leere Eingabe, doppeltes SHIFT und DEL in Vorlagen', async ({ page }) => {
  await press(page, 'exe');
  await expect(page.getByTestId('error')).toHaveCount(0);
  await expect(page.getByTestId('result')).toHaveCount(0);
  await press(page, 'shift', 'shift');
  await expect(page.getByTestId('ind-shift')).toHaveCount(0);
  await press(page, 'shift', 'alpha');
  await expect(page.getByTestId('ind-shift')).toHaveCount(0);
  await expect(page.getByTestId('ind-alpha')).toBeVisible();
  await press(page, 'alpha');
  // Bruch eingeben und Zeichen für Zeichen wieder löschen
  await press(page, 'frac', '1', '2', 'down', '3');
  await press(page, 'del', 'del', 'del', 'del', 'del');
  await expect(page.getByTestId('entry').locator('.m-frac')).toHaveCount(0);
  await expect(page.getByTestId('entry').locator('.m-tok')).toHaveCount(0);
  await type(page, '7=');
  await expectResult(page, '7');
});

test('nach einem Fehler weiterrechnen; nicht verfügbare Tasten melden sich', async ({ page }) => {
  await type(page, '5÷0=');
  await expectError(page, 'Division durch 0');
  // der fehlerhafte Ausdruck bleibt stehen und kann ergänzt werden: 5÷0 → 5÷08
  await type(page, '8=');
  await expectResult(page, '5/8');
  await openMode(page, 'basen');
  await press(page, 'sd');
  await expect(page.getByTestId('toast')).toContainText('nicht verfügbar');
});

test('komplexer Wert in Variable: im Modus Berechnungen verständliche Meldung', async ({ page }) => {
  await openMode(page, 'complex');
  await type(page, '2+3');
  await chip(page, 'i');
  await press(page, 'sto');
  await page.locator('[data-var="A"]').click();
  await expectResult(page, '2+3i');
  await openMode(page, 'calc');
  await press(page, 'alpha', 'neg', 'add', '1', 'exe');
  await expectError(page, 'Komplexe Zahlen');
});

test('Tastatur ein- und ausblenden, Funktionstasten einklappen', async ({ page }) => {
  await openMode(page, 'sheet');
  const before = (await page.getByTestId('display').boundingBox())!.height;
  await expect(page.locator('[data-key="sin"]')).toBeHidden();
  await chip(page, 'fn-keys');
  await expect(page.locator('[data-key="sin"]')).toBeVisible();
  const withFn = (await page.getByTestId('display').boundingBox())!.height;
  expect(withFn).toBeLessThan(before);
  await page.getByTestId('keypad-toggle').click();
  await expect(page.locator('.keypad')).toBeHidden();
  const hidden = (await page.getByTestId('display').boundingBox())!.height;
  expect(hidden).toBeGreaterThan(before);
  await page.getByTestId('keypad-toggle').click();
  await expect(page.locator('.keypad')).toBeVisible();
});

test('Tabellenkalkulation: Navigation bis Zeile 45, Löschen', async ({ page }) => {
  await openMode(page, 'sheet');
  await fill(page, '1');
  for (let i = 0; i < 46; i++) await press(page, 'down');
  await expect(page.locator('[data-cell="A45"]')).toHaveClass(/active/);
  await expect(page.locator('[data-cell="A45"]')).toBeInViewport();
  await fill(page, '9');
  await expect(page.locator('[data-cell="A45"]')).toHaveAttribute('data-value', '9');
  await cell(page, 'A45');
  await press(page, 'ac'); // Bearbeitung abbrechen
  await press(page, 'del'); // Zelle leeren
  await expect(page.locator('[data-cell="A45"]')).toHaveAttribute('data-value', '');
  await press(page, 'right', 'right', 'right', 'right');
  await expect(page.locator('[data-cell="E45"]')).toHaveClass(/active/);
});

test('Statistik mit Häufigkeiten', async ({ page }) => {
  await openMode(page, 'stats');
  await chip(page, 'freq');
  await fill(page, '1', '2', '2', '3', '3', '5');
  await option(page, 'tab', 'stats');
  await expect(page.getByTestId('stat-n')).toContainText('10');
  await expect(page.getByTestId('stat-mean')).toContainText('2,3');
  await expect(page.getByTestId('stat-med')).toContainText('2,5');
});

test('Wertetabelle: ohne Funktion gibt es einen Hinweis, Fehler bleiben in der Eingabezeile', async ({ page }) => {
  await openMode(page, 'table');
  await option(page, 'tab', 'graph');
  await expect(page.getByTestId('display')).toContainText('Zuerst unter „Funktionen“');
  await option(page, 'tab', 'def');
  await press(page, 'x', 'add', 'exe');
  await expect(page.getByTestId('fbar-error')).toContainText('Syntaxfehler');
  await press(page, '1', 'exe');
  await expect(page.getByTestId('fbar-error')).toHaveCount(0);
  await cell(page, 'step');
  await fill(page, '0');
  await expect(page.getByTestId('fbar-error')).toContainText('Schrittweite');
});

test('Daten aller Modi bleiben nach einem Neustart erhalten', async ({ page }) => {
  await openMode(page, 'matrix');
  await option(page, 'tab', 'A');
  await fill(page, '1', '2', '3', '4');
  await openMode(page, 'stats');
  await fill(page, '4', '8');
  await openMode(page, 'equation');
  await fill(page, '1', '-3', '2');
  await openMode(page, 'table');
  await press(page, 'x', 'sq', 'exe');
  await openMode(page, 'sheet');
  await fill(page, '42');
  await page.waitForTimeout(700);
  await page.reload();
  // zuletzt verwendeter Modus wird wieder geöffnet
  await expect(page.getByTestId('mode-title')).toHaveText('Tabellenkalkulation');
  await expect(page.locator('[data-cell="A1"]')).toHaveAttribute('data-value', '42');
  await openMode(page, 'table');
  await option(page, 'tab', 'table');
  await expect(page.getByTestId('table').locator('tbody tr').first().locator('td').nth(1)).toHaveText('25');
  await openMode(page, 'equation');
  await expect(page.getByTestId('eq-x2')).toHaveAttribute('data-value', '2');
  await openMode(page, 'stats');
  await option(page, 'tab', 'stats');
  await expect(page.getByTestId('stat-mean')).toContainText('6');
  await openMode(page, 'matrix');
  await chip(page, 'det');
  await chip(page, 'MatA');
  await press(page, 'exe');
  await expectResult(page, '−2');
});

test('Hardware-Tastatur am PC', async ({ page }) => {
  await page.keyboard.type('12*3-6/4');
  await page.keyboard.press('Enter');
  await expectResult(page, '69/2');
  await page.keyboard.press('Escape');
  await page.keyboard.type('s30)');
  await page.keyboard.press('Enter');
  await expectResult(page, '1/2');
});
