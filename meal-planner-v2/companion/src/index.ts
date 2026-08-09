import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveFeatureFlags } from './config/featureFlags.js';
import { FakeGroceryProvider } from './providers/fakeGroceryProvider.js';
import { createCompanionServer, listenOnLoopback } from './server.js';
import { loadOrCreateToken } from './security/tokenStore.js';

const port = 8787;
const tokenPath = join(homedir(), '.config', 'family-table', 'companion-token');
const token = loadOrCreateToken(tokenPath);
const provider = new FakeGroceryProvider();
const server = createCompanionServer({
  allowedOrigins: new Set(['http://127.0.0.1:5173', 'http://localhost:5173']),
  featureFlags: resolveFeatureFlags(),
  provider,
  token,
});

await listenOnLoopback(server, port);
console.info(`Family Table companion ready on http://127.0.0.1:${port}`);
console.info(`Authentication token stored at ${tokenPath}`);
