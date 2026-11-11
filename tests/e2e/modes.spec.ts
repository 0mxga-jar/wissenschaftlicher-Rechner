import { test, expect, type Page } from '@playwright/test';
import { start, press, type, chip, cell, option, openMode, expectResult, expectError } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

/** Werte nacheinander in die Felder eines Formulars eintragen (jeweils mit = bestätigen). */
async function fill(page: Page, ...values: string[]): Promise<void> {
  for (const v of values) await type(page, `${v}=`);
}

test('Menü zeigt alle zwölf Modi und wechselt den Modus', async ({ page }) => {
  await page.getByTestId('menu-button').click();
  await expect(page.locator('.menu-tile')).toHaveCount(12);
  await page.locator('[data-mode="stats"]').click();
  await expect(page.getByTestId('mode-title')).toHaveText('Statistik');
});

test('2 · Komplexe Zahlen: Rechnen, Betrag, Argument, Polarform', async ({ page }) => {
  await openMode(page, 'complex');
  await type(page, '(1+2');
  await chip(page, 'i');
  await type(page, ')×(3-4');
  await chip(page, 'i');
  await type(page, ')=');
  await expectResult(page, '11+2i');
  await press(page, 'ac');
  await chip(page, 'abs');
  await type(page, '3+4');
  await chip(page, 'i');
  await type(page, '=');
  await expectResult(page, '5');
  await press(page, 'ac');
  await chip(page, 'arg');
  await type(page, '1+');
  await chip(page, 'i');
  await type(page, '=');
  await expectResult(page, '45');
  // Polarform der Ausgabe
  await press(page, 'ac');
  await type(page, '1+');
  await chip(page, 'i');
  await type(page, '=');
  await expectResult(page, '1+i');
  await chip(page, 'polar');
  await expectResult(page, '√2∠45');
  // Eingabe in Polarform
  await chip(page, 'rect');
  await press(page, 'ac', '2', 'shift', 'lp', '3', '0', 'exe');
  await expectResult(page, '√3+i');
  await press(page, 'ac');
  await chip(page, 'conjg');
  await type(page, '2+3');
  await chip(page, 'i');
  await type(page, '=');
  await expectResult(page, '2−3i');
  await press(page, 'ac', 'sqrt', 'sub', '4', 'exe');
  await expectResult(page, '2i');
});

test('3 · Basis-N: HEX/BIN/OCT und logische Operatoren', async ({ page }) => {
  await openMode(page, 'basen');
  await chip(page, 'base-16');
  await chip(page, 'hex-F');
  await chip(page, 'hex-F');
  await type(page, '+1=');
  await expect(page.locator('.result .bn-result')).toHaveAttribute('data-value', '100');
  await expect(page.locator('.bn-all [data-base="10"] .bn-digits')).toHaveText('256');
  await expect(page.locator('.bn-all [data-base="2"] .bn-digits')).toHaveText('1 0000 0000');
  await expect(page.locator('.bn-all [data-base="8"] .bn-digits')).toHaveText('400');
  // Basis umschalten: dasselbe Ergebnis in anderer Darstellung
  await chip(page, 'base-2');
  await expect(page.locator('.result .bn-result')).toHaveAttribute('data-value', '100000000');
  await press(page, 'ac');
  await type(page, '1100');
  await chip(page, 'and');
  await type(page, '1010=');
  await expect(page.locator('.result .bn-result')).toHaveAttribute('data-value', '1000');
  await chip(page, 'base-10');
  await press(page, 'ac', '5');
  await chip(page, 'xor');
  await type(page, '3=');
  await expect(page.locator('.result .bn-result')).toHaveAttribute('data-value', '6');
  await press(page, 'ac');
  await chip(page, 'not');
  await type(page, '0=');
  await expect(page.locator('.result .bn-result')).toHaveAttribute('data-value', '−1');
  await expect(page.locator('.bn-all [data-base="16"] .bn-digits')).toHaveText('FFFF FFFF');
  await press(page, 'ac');
  await type(page, '7÷0=');
  await expectError(page, 'Division durch 0');
});

test('4 · Matrizen: Eingabe, Determinante, Inverse, Produkt', async ({ page }) => {
  await openMode(page, 'matrix');
  await option(page, 'tab', 'A');
  await fill(page, '1', '2', '3', '4');
  await expect(page.locator('[data-cell="1,1"]')).toHaveAttribute('data-value', '4');
  await option(page, 'tab', 'B');
  await fill(page, '0', '1', '1', '0');
  await option(page, 'tab', 'calc');
  await chip(page, 'det');
  await chip(page, 'MatA');
  await press(page, 'exe');
  await expectResult(page, '−2');
  await press(page, 'ac');
  await chip(page, 'MatA');
  await press(page, 'inv', 'exe');
  await expectResult(page, '−2 1 | 3/2 −1/2');
  await expect(page.getByTestId('result').locator('.gridv-cell')).toHaveCount(4);
  await press(page, 'ac');
  await chip(page, 'MatA');
  await press(page, 'mul');
  await chip(page, 'MatB');
  await press(page, 'exe');
  await expectResult(page, '2 1 | 4 3');
  // mit dem Ergebnis weiterrechnen (MatAns) und transponieren
  await press(page, 'ac');
  await chip(page, 'trn');
  await chip(page, 'MatAns');
  await press(page, 'exe');
  await expectResult(page, '2 4 | 1 3');
  await press(page, 'ac');
  await chip(page, 'MatA');
  await press(page, 'sq', 'exe');
  await expectResult(page, '7 10 | 15 22');
  // Dimension ändern: 3×3-Matrix
  await option(page, 'tab', 'C');
  await expect(page.getByTestId('matrix-grid').locator('.cell')).toHaveCount(9);
  await page.locator('[data-stepper="rows"] button[aria-label="mehr"]').click();
  await page.locator('[data-stepper="cols"] button[aria-label="mehr"]').click();
  await expect(page.getByTestId('matrix-grid').locator('.cell')).toHaveCount(16);
});

test('5 · Vektoren: Skalarprodukt, Kreuzprodukt, Betrag, Winkel, Einheitsvektor', async ({ page }) => {
  await openMode(page, 'vector');
  await option(page, 'tab', 'A');
  await fill(page, '1', '2', '3');
  await option(page, 'tab', 'B');
  await fill(page, '4', '5', '6');
  await option(page, 'tab', 'calc');
  await chip(page, 'VctA');
  await chip(page, 'dot');
  await chip(page, 'VctB');
  await press(page, 'exe');
  await expectResult(page, '32');
  await press(page, 'ac');
  await chip(page, 'VctA');
  await press(page, 'mul');
  await chip(page, 'VctB');
  await press(page, 'exe');
  await expectResult(page, '−3 6 −3');
  await press(page, 'ac');
  await chip(page, 'abs');
  await chip(page, 'VctA');
  await press(page, 'exe');
  await expectResult(page, '√14');
  // 2D-Vektoren: Winkel und Einheitsvektor
  await option(page, 'tab', 'C');
  await fill(page, '3', '4');
  await option(page, 'tab', 'D');
  await fill(page, '1', '0');
  await option(page, 'tab', 'calc');
  await chip(page, 'unitv');
  await chip(page, 'VctC');
  await press(page, 'exe');
  await expectResult(page, '3/5 4/5');
  await press(page, 'ac');
  await chip(page, 'angle');
  await chip(page, 'VctC');
  await press(page, 'shift', 'rp');
  await chip(page, 'VctD');
  await press(page, 'exe', 'sd');
  await expectResult(page, '53,13010235');
});

test('6 · Statistik: Kennwerte und lineare Regression', async ({ page }) => {
  await openMode(page, 'stats');
  await fill(page, '1', '2', '3', '4', '5');
  await option(page, 'tab', 'stats');
  await expect(page.getByTestId('stat-n')).toContainText('5');
  await expect(page.getByTestId('stat-mean')).toContainText('3');
  await expect(page.getByTestId('stat-popsd')).toContainText('1,414213562');
  await expect(page.getByTestId('stat-sd')).toContainText('1,58113883');
  await expect(page.getByTestId('stat-med')).toContainText('3');
  await expect(page.getByTestId('stat-q1')).toContainText('1,5');
  // zwei Variablen
  await option(page, 'tab', 'data');
  await chip(page, 'clear');
  await chip(page, 'two');
  await fill(page, '1', '2', '2', '4', '3', '5', '4', '4', '5', '5');
  await option(page, 'tab', 'reg');
  await expect(page.getByTestId('stat-a')).toContainText('2,2');
  await expect(page.getByTestId('stat-b')).toContainText('0,6');
  await expect(page.getByTestId('stat-r')).toContainText('0,7745966692');
  await cell(page, 'ex');
  await fill(page, '6');
  await expect(page.getByTestId('stat-yhat')).toContainText('5,8');
  await fill(page, '4');
  await expect(page.getByTestId('stat-xhat')).toContainText('3');
  // andere Regressionsart
  await option(page, 'regtype', 'quadratic');
  await expect(page.getByTestId('stat-c')).toBeVisible();
  // Häufigkeitsspalte und Zeile löschen
  await option(page, 'tab', 'data');
  await chip(page, 'freq');
  await expect(page.locator('[data-cell="f0"]')).toBeVisible();
  await cell(page, 'x0');
  await chip(page, 'delrow');
  await expect(page.locator('[data-cell="x0"]')).toHaveAttribute('data-value', '2');
});

test('7 · Verteilungen: Normal, Binomial, Poisson', async ({ page }) => {
  await openMode(page, 'dist');
  // Standardnormalverteilung: P(−1 ≤ X ≤ 1)
  await fill(page, '-1', '1');
  await expect(page.getByTestId('dist-p')).toContainText('0,6826894921');
  await option(page, 'kind', 'inv');
  await fill(page, '0,975');
  await expect(page.getByTestId('dist-x')).toContainText('1,959963985');
  await option(page, 'kind', 'pd');
  await fill(page, '0');
  await expect(page.getByTestId('dist-p')).toContainText('0,3989422804');
  // Binomialverteilung
  await option(page, 'dist', 'binom');
  await fill(page, '3', '10', '0,5');
  await expect(page.getByTestId('dist-p')).toContainText('0,1171875');
  await option(page, 'kind', 'cd');
  await expect(page.getByTestId('dist-p')).toContainText('0,171875');
  await expect(page.getByTestId('dist-ge')).toContainText('0,9453125');
  await option(page, 'kind', 'inv');
  await fill(page, '0,5');
  await expect(page.getByTestId('dist-x')).toContainText('5');
  // Poisson
  await option(page, 'dist', 'poisson');
  await option(page, 'kind', 'pd');
  await fill(page, '2', '3');
  await expect(page.getByTestId('dist-p')).toContainText('0,2240418077');
  await option(page, 'kind', 'cd');
  await expect(page.getByTestId('dist-p')).toContainText('0,4231900811');
  // Fehlerfall
  await option(page, 'dist', 'binom');
  await option(page, 'kind', 'pd');
  await cell(page, 'b.p');
  await fill(page, '2');
  await expectError(page, 'zwischen 0 und 1');
});

test('8 · Wertetabelle mit Graph', async ({ page }) => {
  await openMode(page, 'table');
  await press(page, 'x', 'sq', 'sub', '2', 'x', 'exe');
  await press(page, '1', 'div', 'x', 'exe');
  await fill(page, '-2', '2', '1');
  await option(page, 'tab', 'table');
  const rows = page.getByTestId('table').locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('−2');
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('8');
  await expect(rows.nth(0).locator('td').nth(2)).toHaveText('−0,5');
  await expect(rows.nth(2).locator('td').nth(2)).toHaveText('FEHLER');
  await expect(rows.nth(4).locator('td').nth(1)).toHaveText('0');
  await option(page, 'tab', 'graph');
  await expect(page.locator('.g-line')).toHaveCount(2);
  await expect(page.getByTestId('graph-legend').locator('.graph-key')).toHaveCount(2);
  // Ablesen per Antippen
  const box = (await page.locator('.graph-svg').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect(page.locator('.graph-x')).toBeVisible();
  await expect(page.locator('.g-cross')).toHaveCount(1);
});

test('9 · Gleichungen: Polynome und lineare Gleichungssysteme', async ({ page }) => {
  await openMode(page, 'equation');
  await fill(page, '1', '-5', '6');
  await expect(page.getByTestId('eq-x1')).toHaveAttribute('data-value', '2');
  await expect(page.getByTestId('eq-x2')).toHaveAttribute('data-value', '3');
  await expect(page.getByTestId('eq-vertex')).toHaveAttribute('data-value', '5/2|−1/4');
  // komplexe Lösungen, exakt
  await chip(page, 'clear');
  await fill(page, '1', '1', '1');
  await expect(page.getByTestId('eq-x1')).toHaveAttribute('data-value', '−1/2+√3/2i');
  await expect(page.getByTestId('eq-x2')).toHaveAttribute('data-value', '−1/2−√3/2i');
  // S⇔D schaltet auf Dezimalzahlen um
  await chip(page, 'form');
  await expect(page.getByTestId('eq-x1')).toHaveAttribute('data-value', '−0,5+0,8660254038i');
  await chip(page, 'form');
  // Grad 3
  await option(page, 'size', '3');
  await chip(page, 'clear');
  await fill(page, '1', '-6', '11', '-6');
  await expect(page.getByTestId('eq-x1')).toHaveAttribute('data-value', '1');
  await expect(page.getByTestId('eq-x3')).toHaveAttribute('data-value', '3');
  // Grad 4 mit Wurzellösungen
  await option(page, 'size', '4');
  await chip(page, 'clear');
  await fill(page, '1', '0', '-5', '0', '6');
  await expect(page.getByTestId('eq-x1')).toHaveAttribute('data-value', '−√3');
  await expect(page.getByTestId('eq-x4')).toHaveAttribute('data-value', '√3');
  // lineares Gleichungssystem
  await option(page, 'eqkind', 'lin');
  await fill(page, '2', '3', '1', '4', '-1', '1');
  await expect(page.getByTestId('eq-x')).toHaveAttribute('data-value', '2/7');
  await expect(page.getByTestId('eq-y')).toHaveAttribute('data-value', '1/7');
  await option(page, 'size', '3');
  await chip(page, 'clear');
  await fill(page, '1', '1', '1', '6', '2', '-1', '1', '3', '1', '2', '-1', '2');
  await expect(page.getByTestId('eq-x')).toHaveAttribute('data-value', '1');
  await expect(page.getByTestId('eq-y')).toHaveAttribute('data-value', '2');
  await expect(page.getByTestId('eq-z')).toHaveAttribute('data-value', '3');
  // keine Lösung
  await option(page, 'size', '2');
  await chip(page, 'clear');
  await fill(page, '1', '1', '1', '2', '2', '3');
  await expect(page.getByTestId('eq-none')).toBeVisible();
});

test('10 · Ungleichungen: Lösungsmenge als Intervalle', async ({ page }) => {
  await openMode(page, 'ineq');
  await fill(page, '1', '-5', '6');
  await expect(page.getByTestId('ineq-results')).toHaveAttribute('data-value', 'L = ]−∞; 2[ ∪ ]3; ∞[');
  await expect(page.getByTestId('ineq-0')).toHaveAttribute('data-value', 'x < 2');
  await expect(page.getByTestId('ineq-1')).toHaveAttribute('data-value', 'x > 3');
  await option(page, 'op', '<=');
  await expect(page.getByTestId('ineq-results')).toHaveAttribute('data-value', 'L = [2; 3]');
  await expect(page.getByTestId('ineq-0')).toHaveAttribute('data-value', '2 ≤ x ≤ 3');
  await option(page, 'size', '3');
  await chip(page, 'clear');
  await fill(page, '1', '0', '-1', '0');
  await option(page, 'op', '>');
  await expect(page.getByTestId('ineq-results')).toHaveAttribute('data-value', 'L = ]−1; 0[ ∪ ]1; ∞[');
  await option(page, 'size', '2');
  await chip(page, 'clear');
  await fill(page, '1', '0', '1');
  await expect(page.getByTestId('ineq-results')).toHaveAttribute('data-value', 'L = ℝ');
  await option(page, 'op', '<');
  await expect(page.getByTestId('ineq-results')).toHaveAttribute('data-value', 'L = { }');
});

test('11 · Verhältnis', async ({ page }) => {
  await openMode(page, 'ratio');
  await fill(page, '3', '4', '5');
  await expect(page.getByTestId('ratio-x')).toHaveAttribute('data-value', '20/3');
  await option(page, 'ratio', 'xd');
  await fill(page, '8');
  await expect(page.getByTestId('ratio-x')).toHaveAttribute('data-value', '6');
  await chip(page, 'form');
  await option(page, 'ratio', 'cx');
  await expect(page.getByTestId('ratio-x')).toHaveAttribute('data-value', '6,666666667');
});

test('12 · Tabellenkalkulation: Formeln, Zellbezüge, Ausfüllen', async ({ page }) => {
  await openMode(page, 'sheet');
  await fill(page, '5');
  await cell(page, 'A2');
  await fill(page, '7');
  await cell(page, 'A3');
  await chip(page, 'eq');
  await chip(page, 'col-A');
  await type(page, '1+');
  await chip(page, 'col-A');
  await type(page, '2=');
  await expect(page.locator('[data-cell="A3"]')).toHaveAttribute('data-value', '12');
  await cell(page, 'B1');
  await chip(page, 'eq');
  await chip(page, 'sum');
  await chip(page, 'col-A');
  await type(page, '1');
  await chip(page, 'colon');
  await chip(page, 'col-A');
  await type(page, '3=');
  await expect(page.locator('[data-cell="B1"]')).toHaveAttribute('data-value', '24');
  // Änderung einer Quelle rechnet alles neu
  await cell(page, 'A1');
  await fill(page, '10');
  await expect(page.locator('[data-cell="A3"]')).toHaveAttribute('data-value', '17');
  await expect(page.locator('[data-cell="B1"]')).toHaveAttribute('data-value', '34');
  // Formel nach unten ausfüllen: A3 = A1+A2 → A4 = A2+A3
  await cell(page, 'A3');
  await chip(page, 'fill-down');
  await expect(page.locator('[data-cell="A4"]')).toHaveAttribute('data-value', '24');
  // Zirkelbezug wird als Fehler angezeigt
  await cell(page, 'C1');
  await chip(page, 'eq');
  await chip(page, 'col-C');
  await type(page, '1=');
  await expect(page.locator('[data-cell="C1"]')).toHaveAttribute('data-value', 'FEHLER');
  // Syntaxfehler bleibt in der Eingabezeile
  await cell(page, 'D1');
  await type(page, '1+=');
  await expect(page.getByTestId('fbar-error')).toContainText('Syntaxfehler');
});
