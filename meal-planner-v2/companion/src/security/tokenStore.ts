import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function readValidToken(path: string): string {
  const token = readFileSync(path, 'utf8').trim();
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('The companion token file is invalid.');
  }
  return token;
}

export function loadOrCreateToken(path: string): string {
  try {
    const existing = readValidToken(path);
    chmodSync(path, 0o600);
    return existing;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('hex');
  try {
    writeFileSync(path, `${token}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return token;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return readValidToken(path);
    }
    throw error;
  }
}
