import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { defineConfig } from 'vitest/config';

const SERVICE_WORKER_BUILD_ID = '__FAMILY_TABLE_BUILD_ID__';
const SERVICE_WORKER_PRECACHE = '__FAMILY_TABLE_PRECACHE__';

function buildAwareServiceWorker(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'family-table-build-aware-service-worker',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    writeBundle(_outputOptions, bundle) {
      const templatePath = resolve(config.publicDir, 'sw.js');
      const manifestPath = resolve(config.publicDir, 'manifest.webmanifest');
      const iconPath = resolve(config.publicDir, 'icon.svg');
      const template = readFileSync(templatePath, 'utf8');
      const publicAssets = [
        ['/manifest.webmanifest', readFileSync(manifestPath)],
        ['/icon.svg', readFileSync(iconPath)],
      ] as const;
      const outputFiles = Object.keys(bundle)
        .filter((fileName) => fileName !== 'sw.js' && !fileName.endsWith('.map'))
        .sort();
      const precacheUrls = [
        '/',
        ...new Set([
          '/index.html',
          ...outputFiles.map((fileName) => `/${fileName.replace(/^\/+/, '')}`),
          ...publicAssets.map(([url]) => url),
        ]),
      ];

      const hash = createHash('sha256');
      hash.update(template);
      for (const fileName of outputFiles) {
        const output = bundle[fileName];
        hash.update(fileName);
        hash.update(
          output.type === 'chunk'
            ? output.code
            : typeof output.source === 'string'
              ? output.source
              : output.source,
        );
      }
      for (const [url, contents] of publicAssets) {
        hash.update(url);
        hash.update(contents);
      }

      if (
        !template.includes(SERVICE_WORKER_BUILD_ID) ||
        !template.includes(SERVICE_WORKER_PRECACHE)
      ) {
        throw new Error('The service-worker template is missing its build placeholders.');
      }

      const generatedServiceWorker = template
        .replace(SERVICE_WORKER_BUILD_ID, hash.digest('hex').slice(0, 16))
        .replace(SERVICE_WORKER_PRECACHE, JSON.stringify(precacheUrls, null, 2));
      const outputDirectory = resolve(config.root, config.build.outDir);
      writeFileSync(resolve(outputDirectory, 'sw.js'), generatedServiceWorker);
    },
  };
}

export default defineConfig({
  plugins: [react(), buildAwareServiceWorker()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['companion/**', 'e2e/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
