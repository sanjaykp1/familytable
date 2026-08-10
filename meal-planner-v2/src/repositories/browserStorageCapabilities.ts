export type PersistentStorageStatus =
  | 'persistent'
  | 'not-granted'
  | 'unsupported'
  | 'failed';

interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

interface NavigatorLike {
  storage?: StorageManagerLike;
}

export interface BrowserStorageCapabilities {
  checkPersistence(): Promise<PersistentStorageStatus>;
  requestPersistence(): Promise<PersistentStorageStatus>;
}

function browserNavigator(): NavigatorLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

function storageManager(navigatorLike: NavigatorLike | undefined): StorageManagerLike | undefined {
  const manager = navigatorLike?.storage;
  return typeof manager?.persisted === 'function' && typeof manager.persist === 'function'
    ? manager
    : undefined;
}

export function createBrowserStorageCapabilities(
  navigatorLike: NavigatorLike | undefined = browserNavigator(),
): BrowserStorageCapabilities {
  const manager = storageManager(navigatorLike);

  return {
    async checkPersistence() {
      if (!manager) return 'unsupported';
      try {
        return (await manager.persisted!()) ? 'persistent' : 'not-granted';
      } catch {
        return 'failed';
      }
    },
    async requestPersistence() {
      if (!manager) return 'unsupported';
      try {
        return (await manager.persist!()) ? 'persistent' : 'not-granted';
      } catch {
        return 'failed';
      }
    },
  };
}

export const browserStorageCapabilities = createBrowserStorageCapabilities();
