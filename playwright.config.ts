import { defineConfig } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-End-Tests gegen den Produktions-Build (inkl. Service Worker).
 * Zwei Handy-Formate: 375×812 und 412×915.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'de-DE',
    hasTouch: true,
    isMobile: true,
    trace: 'off',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'handy-375x812', use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 } },
    { name: 'handy-412x915', use: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
