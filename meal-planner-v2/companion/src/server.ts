import { createServer, type Server } from 'node:http';
import type { FeatureFlags } from './config/featureFlags.js';
import type { ApiEnvelope, ProviderCapabilities } from './contracts/grocery.js';
import type { GroceryProvider } from './providers/groceryProvider.js';
import { applyRequestGuard } from './security/requestGuard.js';

export const COMPANION_VERSION = '0.1.0';

export interface CompanionServerOptions {
  allowedOrigins: ReadonlySet<string>;
  featureFlags: FeatureFlags;
  provider: GroceryProvider;
  token: string;
}

interface HealthData {
  service: 'family-table-companion';
  status: 'ok';
  provider: string;
  capabilities: ProviderCapabilities;
  features: FeatureFlags;
}

function sendJson<T>(response: import('node:http').ServerResponse, status: number, body: T) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createCompanionServer(options: CompanionServerOptions): Server {
  return createServer(async (request, response) => {
    if (!applyRequestGuard(request, response, options)) return;

    if (request.method === 'GET' && request.url === '/v1/health') {
      try {
        const capabilities = await options.provider.getCapabilities();
        const envelope: ApiEnvelope<HealthData> = {
          data: {
            service: 'family-table-companion',
            status: 'ok',
            provider: options.provider.id,
            capabilities,
            features: options.featureFlags,
          },
          error: null,
          meta: { version: COMPANION_VERSION },
        };
        sendJson(response, 200, envelope);
      } catch {
        const envelope: ApiEnvelope<never> = {
          data: null,
          error: { code: 'provider_unavailable', message: 'The grocery provider is unavailable.' },
          meta: { version: COMPANION_VERSION },
        };
        sendJson(response, 503, envelope);
      }
      return;
    }

    sendJson(response, 404, {
      data: null,
      error: { code: 'not_found', message: 'Route not found.' },
      meta: { version: COMPANION_VERSION },
    });
  });
}

export async function listenOnLoopback(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}
