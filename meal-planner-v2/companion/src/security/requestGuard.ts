import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

function tokensMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export interface RequestGuardOptions {
  allowedOrigins: ReadonlySet<string>;
  token: string;
}

export function applyRequestGuard(
  request: IncomingMessage,
  response: ServerResponse,
  options: RequestGuardOptions,
): boolean {
  const origin = request.headers.origin;
  if (origin && !options.allowedOrigins.has(origin)) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'origin_not_allowed' }));
    return false;
  }

  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.writeHead(204);
    response.end();
    return false;
  }

  const authorization = request.headers.authorization ?? '';
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!tokensMatch(suppliedToken, options.token)) {
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'unauthorized' }));
    return false;
  }

  return true;
}
