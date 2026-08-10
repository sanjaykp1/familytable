import { describe, expect, it, vi } from 'vitest';
import { createBrowserStorageCapabilities } from './browserStorageCapabilities';

describe('browser storage capabilities', () => {
  it('is safe without a browser storage manager', async () => {
    const capabilities = createBrowserStorageCapabilities(undefined);

    await expect(capabilities.checkPersistence()).resolves.toBe('unsupported');
    await expect(capabilities.requestPersistence()).resolves.toBe('unsupported');
  });

  it('reports whether the browser has already granted persistent storage', async () => {
    const capabilities = createBrowserStorageCapabilities({
      storage: { persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) },
    });

    await expect(capabilities.checkPersistence()).resolves.toBe('not-granted');
    await expect(capabilities.requestPersistence()).resolves.toBe('persistent');
  });

  it('treats a declined request as a normal not-granted result', async () => {
    const capabilities = createBrowserStorageCapabilities({
      storage: { persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) },
    });

    await expect(capabilities.requestPersistence()).resolves.toBe('not-granted');
  });

  it('reports API failures without throwing into the app', async () => {
    const capabilities = createBrowserStorageCapabilities({
      storage: { persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn() },
    });

    await expect(capabilities.checkPersistence()).resolves.toBe('failed');
  });
});
