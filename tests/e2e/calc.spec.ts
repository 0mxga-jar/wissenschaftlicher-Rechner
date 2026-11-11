import { test, expect } from '@playwright/test';
import { start, press, type, chip, cell, option, expectResult, expectError } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

test.describe('Berechnungen', () => {
  test('Grundrechenarten mit Punkt-vor-Strich', async ({ page }) => {
    await type(page, '1+2×3=');
    await expectResult(page, '7');
  });

  test('Natural Display: Bruch plus Wurzel, exakt und mit S⇔D dezimal', async ({ page }) => {
    await press(page, 'frac', '1', 'down', '2', 'right', 'add', 'sqrt', '8', 'right', 'exe');
    await expectResult(page, '(1+4√2)/2');
    // die Eingabe wird als echter Bruch und echte Wurzel gezeichnet
    await expect(page.getByTestId('entry').locator('.m-frac')).toHaveCount(1);
    await expect(page.getByTestId('entry').locator('.m-sqrt')).toHaveCount(1);
    await expect(page.getByTestId('result').locator('.m-frac')).toHaveCount(1);
    await press(page, 'sd');
    await expectResult(page, '3,328427125');
    await press(page, 'sd');
    await expectResult(page, '(1+4√2)/2');
  });

  test('gemischte Brüche', async ({ page }) => {
    await press(page, 'frac', '7', 'down', '2', 'exe');
    await expectResult(page, '7/2');
    await press(page, 'shift', 'sd');
    await expectResult(page, '3 1/2');
    await press(page, 'ac', 'shift', 'frac', '2', 'right', '1', 'right', '3', 'exe');
    await expectResult(page, '7/3');
  });

  test('Trigonometrie mit SHIFT-Zweitbelegung und Winkeleinheiten', async ({ page }) => {
    await press(page, 'sin', '3', '0', 'exe');
    await expectResult(page, '1/2');
    await press(page, 'shift');
    await expect(page.getByTestId('ind-shift')).toBeVisible();
    await press(page, 'sin', '0', 'dot', '5', 'exe');
    await expect(page.getByTestId('ind-shift')).toHaveCount(0);
    await expectResult(page, '30');
    // auf Bogenmaß umschalten (Statusanzeige antippen)
    await page.getByTestId('ind-angle').click();
    await expect(page.getByTestId('ind-angle')).toHaveText('RAD');
    await press(page, 'ac', 'sin', 'pi', 'div', '2', 'exe');
    await expectResult(page, '1');
    await press(page, 'ac', 'shift', 'cos', '0', 'exe');
    await expectResult(page, 'π/2');
  });

  test('ALPHA-Belegung, Variablen mit STO und RCL', async ({ page }) => {
    await press(page, '7', 'sto');
    await page.locator('[data-var="A"]').click();
    await expectResult(page, '7');
    await press(page, 'alpha');
    await expect(page.getByTestId('ind-alpha')).toBeVisible();
    await press(page, 'neg', 'mul', '2', 'exe'); // ALPHA + (−) = A
    await expectResult(page, '14');
    await press(page, 'ac', 'shift', 'sto'); // RCL
    await expect(page.locator('[data-var="A"] .var-val')).toHaveText('7');
    await page.locator('[data-var="A"]').click();
    await press(page, 'sq', 'exe');
    await expectResult(page, '49');
  });

  test('M+ und M−', async ({ page }) => {
    await press(page, '5', 'mplus');
    await expect(page.getByTestId('ind-m')).toBeVisible();
    await press(page, '3', 'mplus', '2', 'shift', 'mplus');
    await press(page, 'alpha', 'mplus', 'exe');
    await expectResult(page, '6');
  });

  test('Ans und Weiterrechnen mit dem letzten Ergebnis', async ({ page }) => {
    await type(page, '5=');
    await type(page, '+2=');
    await expectResult(page, '7');
    await press(page, 'exe', 'exe');
    await expectResult(page, '11');
    await press(page, 'sq', 'exe');
    await expectResult(page, '121');
    await type(page, '3=');
    await expectResult(page, '3');
  });

  test('Verlauf: frühere Eingabe zurückholen, bearbeiten und neu berechnen', async ({ page }) => {
    await type(page, '2+3=');
    await type(page, '4×5=');
    await expectResult(page, '20');
    await press(page, 'up');
    await expectResult(page, '5');
    await press(page, 'down');
    await expectResult(page, '20');
    await press(page, 'up');
    // bearbeiten: Cursor ans Ende, 3 löschen, 9 tippen
    await press(page, 'left', 'del', '9', 'exe');
    await expectResult(page, '11');
    // Verlaufseintrag antippen
    await page.locator('.hist-item').first().click();
    await expectResult(page, '5');
  });

  test('Fehlermeldungen auf Deutsch', async ({ page }) => {
    await type(page, '1÷0=');
    await expectError(page, 'Division durch 0');
    await press(page, 'ac');
    await expect(page.getByTestId('error')).toHaveCount(0);
    await type(page, '1+=');
    await expectError(page, 'Syntaxfehler');
    await press(page, 'ac', 'sqrt', 'neg', '4', 'exe');
    await expectError(page, 'Mathematischer Fehler');
    // nach einem Fehler kann der Ausdruck korrigiert werden
    await press(page, 'left', 'left', 'left', 'del', 'exe');
    await expectResult(page, '2');
  });

  test('Potenzen, Fakultät, nCr und Primfaktorzerlegung', async ({ page }) => {
    await press(page, '2', 'pow', '1', '0', 'exe');
    await expectResult(page, '1024');
    await press(page, 'ac', '5', 'shift', 'inv', 'exe');
    await expectResult(page, '120');
    await press(page, 'ac', '1', '0', 'shift', 'div', '3', 'exe');
    await expectResult(page, '120');
    await press(page, 'ac', '3', '6', '0', 'exe', 'shift', 'dms');
    await expectResult(page, '2³×3²×5');
  });

  test('Grad-Minuten-Sekunden', async ({ page }) => {
    await press(page, '1', 'dot', '5', 'exe', 'dms');
    await expectResult(page, '1°30′0″');
    await press(page, 'ac', '2', 'dms', '3', '0', 'dms', 'exe');
    await expectResult(page, '5/2');
  });

  test('Integral, Ableitung und Summe', async ({ page }) => {
    await press(page, 'int', 'x', 'sq', 'right', '0', 'right', '3', 'exe');
    await expectResult(page, '9');
    await expect(page.getByTestId('entry').locator('.m-int')).toHaveCount(1);
    await press(page, 'ac', 'shift', 'int', 'x', 'shift', 'sq', 'right', '2', 'exe');
    await expectResult(page, '12');
    await press(page, 'ac', 'sum', 'x', 'right', '1', 'up', '1', '0', '0', 'exe');
    await expectResult(page, '5050');
  });

  test('SOLVE löst eine Gleichung mit Startwert', async ({ page }) => {
    await press(page, 'x', 'sq', 'alpha', 'calc', '2', 'shift', 'calc');
    await expect(page.getByTestId('sub-solve')).toBeVisible();
    await press(page, '1', 'exe');
    await expect(page.getByTestId('solve-result')).toHaveAttribute('data-value', '1,414213562');
    // anderer Startwert → andere Lösung
    await cell(page, 'x');
    await press(page, 'sub', '1');
    await chip(page, 'run');
    await expect(page.getByTestId('solve-result')).toHaveAttribute('data-value', '−1,414213562');
    await chip(page, 'back');
    await expect(page.getByTestId('sub-solve')).toHaveCount(0);
  });

  test('CALC setzt Variablenwerte ein', async ({ page }) => {
    await press(page, '2', 'x', 'add', '1', 'calc');
    await expect(page.getByTestId('sub-calc')).toBeVisible();
    await press(page, '5', 'exe');
    await expectResult(page, '11');
  });

  test('Konstanten und Einheitenumrechnung', async ({ page }) => {
    await press(page, 'shift', 'cat');
    await page.locator('[data-const="c0"]').click();
    await press(page, 'exe');
    await expectResult(page, '299792458');
    await press(page, 'ac', '1', 'alpha', 'cat');
    await page.locator('[data-from="in"]').click();
    await page.locator('[data-to="cm"]').click();
    await page.getByTestId('conv-insert').click();
    await press(page, 'exe');
    await expectResult(page, '2,54');
  });

  test('Katalog und Hyperbelfunktionen', async ({ page }) => {
    await press(page, 'cat');
    await page.locator('[data-action="t:ggT("]').click();
    await type(page, '12');
    await press(page, 'shift', 'rp'); // ;
    await type(page, '18)=');
    await expectResult(page, '6');
    await press(page, 'ac', 'hyp');
    await page.locator('[data-action="t:cosh("]').click();
    await type(page, '0=');
    await expectResult(page, '1');
  });

  test('Cursor per Antippen setzen', async ({ page }) => {
    await type(page, '123');
    const first = page.getByTestId('entry').locator('.m-tok').first();
    const box = (await first.boundingBox())!;
    await page.mouse.click(box.x + 1, box.y + box.height / 2);
    await press(page, '9', 'exe');
    await expectResult(page, '9123');
  });
});

test.describe('Einstellungen', () => {
  test('Zahlenformat, Dezimaltrennzeichen und Ergebnisformat', async ({ page }) => {
    await type(page, '2÷3=');
    await expectResult(page, '2/3');
    await page.getByTestId('setup-button').click();
    await option(page, 'resultForm', 'decimal');
    await option(page, 'numMode', 'fix');
    await page.locator('[data-stepper="fix"] button[aria-label="mehr"]').click();
    await option(page, 'comma', 'point');
    await page.getByTestId('overlay-close').click();
    await expect(page.getByTestId('ind-format')).toHaveText('Fix 3');
    await press(page, 'exe');
    await expectResult(page, '0.667');
    await expect(page.locator('[data-key="dot"]')).toHaveText('.');
  });

  test('Dark/Light und Zurücksetzen', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('setup-button').click();
    await option(page, 'theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await option(page, 'angle', 'GRA');
    await page.locator('[data-reset="all"]').click();
    await page.getByTestId('reset-confirm').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('overlay-close').click();
    await expect(page.getByTestId('ind-angle')).toHaveText('DEG');
  });

  test('Einstellungen, Variablen und Verlauf bleiben nach Neustart erhalten', async ({ page }) => {
    await page.getByTestId('ind-angle').click();
    await type(page, '6×7=');
    await press(page, 'sto');
    await page.locator('[data-var="B"]').click();
    await page.waitForTimeout(700); // verzögertes Speichern
    await page.reload();
    await expect(page.getByTestId('ind-angle')).toHaveText('RAD');
    await press(page, 'alpha', 'dms', 'exe'); // B
    await expectResult(page, '42');
    await press(page, 'up', 'up');
    await expect(page.getByTestId('entry')).toContainText('6×7');
  });
});
