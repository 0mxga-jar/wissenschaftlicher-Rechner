import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { start, press, type, openMode } from './helpers';

const MODES = ['calc', 'complex', 'basen', 'matrix', 'vector', 'stats', 'dist', 'table', 'equation', 'ineq', 'ratio', 'sheet'];
const SHOTS = 'test-results/screenshots';
mkdirSync(SHOTS, { recursive: true });

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

async function keyBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.keypad .key')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.key ?? '', x: r.left, y: r.top, w: r.width, h: r.height };
      }),
  );
}

/** Prüft: kein Überlauf, alle Tasten vollständig sichtbar, keine Überlappungen, ausreichend große Touch-Flächen. */
async function checkLayout(page: Page, opts: { minKeyW: number; minKeyH: number; minDisplayH: number }): Promise<void> {
  const vp = page.viewportSize()!;
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }));
  expect(overflow.sw, 'kein horizontales Scrollen').toBeLessThanOrEqual(overflow.cw);
  expect(overflow.sh, 'kein vertikales Scrollen der Seite').toBeLessThanOrEqual(overflow.ch);

  const keys = await keyBoxes(page);
  expect(keys.length).toBeGreaterThanOrEqual(26);
  for (const k of keys) {
    expect(k.x, `Taste ${k.id} links im Bild`).toBeGreaterThanOrEqual(0);
    expect(k.y, `Taste ${k.id} oben im Bild`).toBeGreaterThanOrEqual(0);
    expect(k.x + k.w, `Taste ${k.id} rechts im Bild`).toBeLessThanOrEqual(vp.width + 0.5);
    expect(k.y + k.h, `Taste ${k.id} unten im Bild`).toBeLessThanOrEqual(vp.height + 0.5);
    expect(k.w, `Breite der Taste ${k.id}`).toBeGreaterThanOrEqual(opts.minKeyW);
    expect(k.h, `Höhe der Taste ${k.id}`).toBeGreaterThanOrEqual(opts.minKeyH);
  }
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
      expect(overlap, `Tasten ${a.id} und ${b.id} überlappen`).toBe(false);
    }
  }
  const display = (await page.getByTestId('display').boundingBox())!;
  expect(display.height, 'Höhe des Displays').toBeGreaterThanOrEqual(opts.minDisplayH);
  expect(display.x + display.width).toBeLessThanOrEqual(vp.width);
  // das Display liegt vollständig über der Tastatur
  const top = Math.min(...keys.map((k) => k.y));
  if (vp.height > vp.width) expect(display.y + display.height).toBeLessThanOrEqual(top);
  // Titel und Kopfzeile sind nicht abgeschnitten
  const title = await page.getByTestId('mode-title').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(title.sw, 'Titel nicht abgeschnitten').toBeLessThanOrEqual(title.cw);
}

test.beforeEach(async ({ page }) => {
  await start(page);
});

test('Layout im Hochformat ist sauber (mit Screenshot)', async ({ page }, info) => {
  await checkLayout(page, { minKeyW: 44, minKeyH: 26, minDisplayH: 170 });
  await press(page, 'frac', '1', 'down', '2', 'right', 'add', 'sqrt', '8', 'right', 'exe');
  await press(page, 'int', 'x', 'sq', 'right', '0', 'right', '3');
  await page.waitForTimeout(250);
  await checkLayout(page, { minKeyW: 44, minKeyH: 26, minDisplayH: 170 });
  // die Eingabe ragt nicht aus dem Display heraus
  const display = (await page.getByTestId('display').boundingBox())!;
  const entry = (await page.getByTestId('entry').boundingBox())!;
  expect(entry.y).toBeGreaterThanOrEqual(display.y);
  expect(entry.y + entry.height).toBeLessThanOrEqual(display.y + display.height);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-berechnungen.png` });
});

test('SHIFT- und ALPHA-Beschriftungen stehen über den Tasten', async ({ page }) => {
  const rel = await page.evaluate(() => {
    const wrap = document.querySelector('[data-key="sin"]')!.parentElement!;
    const sec = wrap.querySelector('.key-sec')!.getBoundingClientRect();
    const key = wrap.querySelector('.key')!.getBoundingClientRect();
    return { secBottom: sec.bottom, keyTop: key.top, shift: wrap.querySelector('.sec-shift')!.textContent, alpha: wrap.querySelector('.sec-alpha')!.textContent };
  });
  expect(rel.secBottom).toBeLessThanOrEqual(rel.keyTop + 0.5);
  expect(rel.shift).toBe('sin−1');
  expect(rel.alpha).toBe('D');
});

for (const mode of MODES) {
  test(`Layout im Modus „${mode}“`, async ({ page }, info) => {
    if (mode !== 'calc') await openMode(page, mode);
    await page.waitForTimeout(200);
    await checkLayout(page, { minKeyW: 44, minKeyH: 20, minDisplayH: 170 });
    // Kontextleiste liegt zwischen Display und Tastatur
    const chips = (await page.getByTestId('chips').boundingBox())!;
    const display = (await page.getByTestId('display').boundingBox())!;
    expect(chips.y).toBeGreaterThanOrEqual(display.y + display.height - 1);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-${mode}.png` });
  });
}

test('Menü und Einstellungen passen auf den Bildschirm', async ({ page }, info) => {
  const vp = page.viewportSize()!;
  await page.getByTestId('menu-button').click();
  await page.waitForTimeout(300);
  const tiles = await page.locator('.menu-tile').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(tiles).toHaveLength(12);
  for (const t of tiles) {
    expect(t.left).toBeGreaterThanOrEqual(0);
    expect(t.right).toBeLessThanOrEqual(vp.width);
    expect(t.width).toBeGreaterThanOrEqual(90);
    expect(t.bottom, 'alle zwölf Modi ohne Scrollen sichtbar').toBeLessThanOrEqual(vp.height);
  }
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-menu.png` });
  await page.getByTestId('overlay-close').click();
  await page.getByTestId('setup-button').click();
  await page.waitForTimeout(300);
  const segs = await page.locator('.sheet .seg').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  for (const s of segs) {
    expect(s.left).toBeGreaterThanOrEqual(0);
    expect(s.right).toBeLessThanOrEqual(vp.width);
  }
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-einstellungen.png` });
});

test('Querformat: Display links, Tastatur rechts', async ({ page }, info) => {
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await type(page, '12+3=');
  await page.waitForTimeout(250);
  await checkLayout(page, { minKeyW: 30, minKeyH: 24, minDisplayH: 150 });
  const display = (await page.getByTestId('display').boundingBox())!;
  const seven = (await page.locator('[data-key="7"]').boundingBox())!;
  expect(display.x + display.width).toBeLessThanOrEqual(seven.x);
  await expect(page.getByTestId('result')).toHaveAttribute('data-value', '15');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-querformat.png` });
});

test('kleines Handy (360×640) bleibt bedienbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(200);
  await checkLayout(page, { minKeyW: 44, minKeyH: 20, minDisplayH: 120 });
  await type(page, '7×8=');
  await expect(page.getByTestId('result')).toHaveAttribute('data-value', '56');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-klein.png` });
});

test('helles Design', async ({ page }, info) => {
  await page.getByTestId('setup-button').click();
  await page.locator('[data-seg="theme"] [data-opt="light"]').click();
  await page.getByTestId('overlay-close').click();
  await press(page, 'sin', '4', '5', 'exe');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(233, 237, 242)');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-hell.png` });
});
