// Erzeugt die App-Icons (SVG → PNG) mit dem Chromium von Playwright.
// Aufruf: npm run icons   (die erzeugten PNG-Dateien liegen im Repository; der Build braucht dieses Skript nicht)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

/** Motiv: getöntes Display mit Wurzelzeichen und x, darunter acht Tasten. */
const artwork = `
  <rect x="72" y="70" width="368" height="172" rx="38" fill="url(#disp)" stroke="#23403a" stroke-width="4"/>
  <path d="M120 170 l24 -11 l33 60 l39 -118 h168" fill="none" stroke="#5eead4" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M258 148 l58 64 M316 148 l-58 64" fill="none" stroke="#ecfff8" stroke-width="17" stroke-linecap="round"/>
  <g>
    <rect x="72" y="278" width="80" height="68" rx="20" fill="none" stroke="#f6b93b" stroke-width="7"/>
    <rect x="168" y="278" width="80" height="68" rx="20" fill="#2a3442"/>
    <rect x="264" y="278" width="80" height="68" rx="20" fill="#2a3442"/>
    <rect x="360" y="278" width="80" height="68" rx="20" fill="#27395c"/>
    <rect x="72" y="366" width="80" height="68" rx="20" fill="#2a3442"/>
    <rect x="168" y="366" width="80" height="68" rx="20" fill="#2a3442"/>
    <rect x="264" y="366" width="80" height="68" rx="20" fill="#2a3442"/>
    <rect x="360" y="366" width="80" height="68" rx="20" fill="#35d6a4"/>
    <path d="M385 392 h30 M385 408 h30" stroke="#04261b" stroke-width="8" stroke-linecap="round"/>
    <path d="M385 312 h30 M400 297 v30" stroke="#a8c8ff" stroke-width="8" stroke-linecap="round"/>
  </g>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#18222d"/>
      <stop offset="1" stop-color="#0a0e13"/>
    </linearGradient>
    <linearGradient id="disp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#142924"/>
      <stop offset="1" stop-color="#0d1b18"/>
    </linearGradient>
  </defs>`;

const svg = (kind) => {
  const bg =
    kind === 'rounded'
      ? '<rect width="512" height="512" rx="114" fill="url(#bg)"/>'
      : '<rect width="512" height="512" fill="url(#bg)"/>';
  // maskierbare Icons: Motiv in die sichere Zone (mittlere 80 %) verkleinern
  const inner = kind === 'maskable' ? `<g transform="translate(256 256) scale(0.78) translate(-256 -256)">${artwork}</g>` : artwork;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}${bg}${inner}</svg>`;
};

writeFileSync(join(out, 'icon.svg'), svg('rounded'));

const targets = [
  ['icon-192.png', 'rounded', 192],
  ['icon-512.png', 'rounded', 512],
  ['icon-maskable-192.png', 'maskable', 192],
  ['icon-maskable-512.png', 'maskable', 512],
  ['apple-touch-icon.png', 'square', 180],
];

const browser = await chromium.launch();
for (const [file, kind, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(kind)}`,
  );
  await page.screenshot({ path: join(out, file), omitBackground: true });
  await page.close();
  console.log('erzeugt:', file);
}
await browser.close();
