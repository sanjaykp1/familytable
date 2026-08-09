import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeGroceryProvider } from '../src/providers/fakeGroceryProvider.js';
import { createCompanionServer, listenOnLoopback } from '../src/server.js';
import { loadOrCreateToken } from '../src/security/tokenStore.js';

const openServers: import('node:http').Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startTestServer() {
  const server = createCompanionServer({
    allowedOrigins: new Set(['http://127.0.0.1:5173']),
    featureFlags: {
      odaLiveReadOnly: false,
      odaCartWrites: false,
      odaOrderImport: false,
      homeStock: false,
    },
    provider: new FakeGroceryProvider(),
    token: 'a'.repeat(64),
  });
  openServers.push(server);
  await listenOnLoopback(server, 0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test server.');
  return `http://127.0.0.1:${address.port}`;
}

describe('companion request guard', () => {
  it('serves the allowlisted health response with a valid token', async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/v1/health`, {
      headers: {
        Authorization: `Bearer ${'a'.repeat(64)}`,
        Origin: 'http://127.0.0.1:5173',
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { service: 'family-table-companion', provider: 'fake-oda' },
      error: null,
    });
  });

  it('rejects missing tokens and non-allowlisted browser origins', async () => {
    const baseUrl = await startTestServer();
    const missingToken = await fetch(`${baseUrl}/v1/health`, {
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    expect(missingToken.status).toBe(401);

    const wrongOrigin = await fetch(`${baseUrl}/v1/health`, {
      headers: { Authorization: `Bearer ${'a'.repeat(64)}`, Origin: 'https://example.com' },
    });
    expect(wrongOrigin.status).toBe(403);
  });

  it('does not expose arbitrary provider routes', async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/v1/mcp/call`, {
      headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
    });
    expect(response.status).toBe(404);
  });
});

describe('companion token store', () => {
  it('creates and reuses a private random token file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'family-table-companion-'));
    const path = join(directory, 'config', 'token');
    const first = loadOrCreateToken(path);
    const second = loadOrCreateToken(path);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(readFileSync(path, 'utf8').trim()).toBe(first);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
