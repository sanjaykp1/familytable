import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

const WEBKIT_PREVIEW_PORT = 4174;

async function startPreviewServer(port: number): Promise<ChildProcess> {
  const server = spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: process.cwd(), stdio: 'ignore' },
  );
  const stopOnWorkerExit = () => {
    if (server.exitCode === null) server.kill('SIGTERM');
  };
  process.once('exit', stopOnWorkerExit);
  server.once('exit', () => process.removeListener('exit', stopOnWorkerExit));
  const url = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error('The WebKit preview server stopped before use.');
    try {
      const response = await fetch(url);
      if (response.ok) return server;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  server.kill('SIGTERM');
  throw new Error('Timed out waiting for the WebKit preview server.');
}

async function stopPreviewServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit'),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out stopping the WebKit preview server.')), 5_000),
    ),
  ]);
}

test('reloads into an interactive app offline with local household data intact', async ({
  browserName,
  context,
  page,
}) => {
  const itemName = 'Offline oats';
  const webkitPreview =
    browserName === 'webkit' ? await startPreviewServer(WEBKIT_PREVIEW_PORT) : null;
  const appUrl =
    browserName === 'webkit' ? `http://127.0.0.1:${WEBKIT_PREVIEW_PORT}/#/shopping` : '/#/shopping';

  await page.goto(appUrl);
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    const precacheName = (await caches.keys()).find((name) =>
      name.startsWith('family-table-v2-precache-'),
    );
    if (!registration.active || !navigator.serviceWorker.controller || !precacheName) return false;
    const requests = await (await caches.open(precacheName)).keys();
    const paths = requests.map((request) => new URL(request.url).pathname);
    return (
      paths.includes('/index.html') &&
      paths.some((path) => path.endsWith('.js')) &&
      paths.some((path) => path.endsWith('.css'))
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Shop & Home Stock.' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await page.getByRole('button', { name: 'At home' }).click();
  await page.getByRole('button', { name: 'Add to Home Stock' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add to Home Stock' });
  await dialog.getByLabel('Item name').fill(itemName);
  await dialog.getByLabel('Category').selectOption('pantry');
  await dialog.getByLabel('Quantity', { exact: true }).fill('1');
  await dialog.getByLabel('Unit', { exact: true }).fill('kg');
  await dialog.getByRole('button', { name: 'Save to Home Stock' }).click();
  await expect(page.getByRole('heading', { name: itemName })).toBeVisible();
  await page.waitForFunction(
    (persistedName) => localStorage.getItem('family-table:v2')?.includes(persistedName),
    itemName,
  );

  if (webkitPreview) await stopPreviewServer(webkitPreview);
  else await context.setOffline(true);
  const reload = page.waitForEvent('framenavigated');
  await page.evaluate(() => {
    window.setTimeout(() => window.location.reload(), 0);
  });
  await reload;

  await page.getByRole('button', { name: 'At home' }).click();
  const stockItem = page.locator('.stock-card, .stock-list__item', { hasText: itemName });
  await expect(stockItem.getByRole('heading', { name: itemName })).toBeVisible();
  await stockItem.getByRole('button', { name: `Increase ${itemName} quantity` }).click();
  await expect(stockItem.getByText('2 kg', { exact: true })).toBeVisible();
});
