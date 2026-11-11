import { expect, type Page } from '@playwright/test';

/** App mit leerem Speicher öffnen. */
export async function start(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.keypad')).toBeVisible();
}

/** Tasten der Bildschirmtastatur drücken (IDs wie „7“, „add“, „sin“, „exe“). */
export async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const k of keys) await page.locator(`[data-key="${k}"]`).click();
}

/** Ziffernfolge und einfache Zeichen tippen: „12,5“ → Tasten 1, 2, dot, 5. */
export async function type(page: Page, text: string): Promise<void> {
  const map: Record<string, string> = { ',': 'dot', '+': 'add', '-': 'sub', '×': 'mul', '÷': 'div', '(': 'lp', ')': 'rp', '=': 'exe' };
  for (const c of text) await press(page, map[c] ?? c);
}

export async function chip(page: Page, id: string): Promise<void> {
  await page.locator(`[data-chip="${id}"]`).click();
}

export async function cell(page: Page, key: string): Promise<void> {
  await page.locator(`[data-cell="${key}"]`).click();
}

export async function option(page: Page, seg: string, opt: string): Promise<void> {
  await page.locator(`[data-seg="${seg}"] [data-opt="${opt}"]`).click();
}

export async function openMode(page: Page, id: string): Promise<void> {
  await page.getByTestId('menu-button').click();
  await page.locator(`[data-mode="${id}"]`).click();
  await expect(page.getByTestId('menu')).toHaveCount(0);
}

/** Erwartet den Text des aktuellen Ergebnisses im Rechen-Display. */
export async function expectResult(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId('result')).toHaveAttribute('data-value', text);
}

export async function expectError(page: Page, text: RegExp | string): Promise<void> {
  await expect(page.getByTestId('error')).toContainText(text);
}
