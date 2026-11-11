import { test, expect } from '@playwright/test';
import { start, type } from './helpers';

test('Manifest, Icons und Metadaten für die Installation', async ({ page, request, baseURL }) => {
  await start(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');

  const res = await request.get(`${baseURL}manifest.webmanifest`);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.short_name).toBe('Rechenwerk');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.lang).toBe('de');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);

  for (const icon of manifest.icons as Array<{ src: string; sizes: string; type: string }>) {
    const r = await request.get(`${baseURL}${icon.src}`);
    expect(r.ok(), icon.src).toBe(true);
    if (icon.type === 'image/png') {
      // tatsächliche Bildgröße prüfen
      const dims = await page.evaluate(async (url) => {
        const blob = await (await fetch(url)).blob();
        const bmp = await createImageBitmap(blob);
        return `${bmp.width}x${bmp.height}`;
      }, icon.src);
      expect(dims).toBe(icon.sizes);
    }
  }
  const apple = await request.get(`${baseURL}icons/apple-touch-icon.png`);
  expect(apple.ok()).toBe(true);
});

test('Service Worker: App startet und rechnet ohne Netzwerk', async ({ page, context }) => {
  await start(page);
  // warten, bis der Service Worker aktiv ist und alle Dateien im Cache liegen
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(async () => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('rechenwerk-'))))
    .toBe(true);
  await page.reload();
  await expect.poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.keypad')).toBeVisible();
  await type(page, '2+3=');
  await expect(page.getByTestId('result')).toHaveAttribute('data-value', '5');
  // Schriften kommen ebenfalls aus dem Cache
  const fonts = await page.evaluate(async () => {
    const faces = [
      ...(await document.fonts.load('500 16px "IBM Plex Sans"', 'Abc')),
      ...(await document.fonts.load('400 16px "IBM Plex Sans"', 'πΣ')),
      ...(await document.fonts.load('400 16px "Rechenwerk Mono"', '1230')),
      ...(await document.fonts.load('italic 400 16px "Rechenwerk Mono"', 'x')),
    ];
    return faces.map((f) => f.status);
  });
  expect(fonts.length).toBeGreaterThanOrEqual(4);
  expect(fonts.every((s) => s === 'loaded')).toBe(true);
  // alle vorab gespeicherten Dateien sind ohne Netzwerk abrufbar
  const assets = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('rechenwerk-'))!);
    const urls = (await cache.keys()).map((r) => r.url);
    const results = await Promise.all(urls.map((u) => fetch(u).then((r) => r.ok).catch(() => false)));
    return { count: urls.length, ok: results.every(Boolean) };
  });
  expect(assets.count).toBeGreaterThanOrEqual(15);
  expect(assets.ok).toBe(true);
  // auch ein anderer Modus funktioniert offline
  await page.getByTestId('menu-button').click();
  await page.locator('[data-mode="equation"]').click();
  await expect(page.getByTestId('mode-title')).toHaveText('Gleichungen');
  await context.setOffline(false);
});

test('Build verwendet relative Pfade (läuft in jedem Unterverzeichnis)', async ({ request, baseURL }) => {
  const html = await (await request.get(`${baseURL}`)).text();
  expect(html).toContain('src="./assets/');
  expect(html).toContain('href="./assets/');
  expect(html).not.toMatch(/(src|href)="\/(assets|icons)/);
  const sw = await (await request.get(`${baseURL}sw.js`)).text();
  expect(sw).toContain('"./index.html"');
  expect(sw).toContain('./manifest.webmanifest');
});
