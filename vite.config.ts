import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Erzeugt nach dem Build einen Service Worker (dist/sw.js), der alle Dateien
 * vorab in den Cache legt – die App funktioniert danach vollständig offline.
 */
function offlineServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'rechenwerk-offline-sw',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const assets = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of assets) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const sw = template
        .replace('__CACHE_VERSION__', version)
        .replace('"__PRECACHE_LIST__"', JSON.stringify(['./', ...assets.map((f) => `./${f}`)]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  // Relativer Basispfad: derselbe Build läuft unter GitHub Pages (/repo-name/),
  // Netlify (/) und in jedem anderen Unterverzeichnis.
  base: './',
  plugins: [offlineServiceWorker()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
