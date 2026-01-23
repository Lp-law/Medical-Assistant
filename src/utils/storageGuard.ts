const shouldBlockKey = (storageName: string, action: string, key: string): boolean => {
  if (!key.startsWith('lexmedical_')) {
    return false;
  }
  const message = `[storage-guard] ${storageName}.${action} blocked for PHI key "${key}". Data stays server-side only.`;
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(message);
  }
  // eslint-disable-next-line no-console
  console.warn(message);
  return true;
};

const warnClear = (storageName: string): void => {
  const message = `[storage-guard] ${storageName}.clear() called. PHI is never stored locally.`;
  // eslint-disable-next-line no-console
  console.warn(message);
};

const patchStorage = (storageName: 'localStorage' | 'sessionStorage', storage: Storage | undefined): void => {
  if (!storage) return;

  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (key: string, value: string) => {
    if (shouldBlockKey(storageName, 'setItem', key)) {
      return;
    }
    originalSet(key, value);
  };

  const originalGet = storage.getItem.bind(storage);
  storage.getItem = (key: string) => {
    if (shouldBlockKey(storageName, 'getItem', key)) {
      return null;
    }
    return originalGet(key);
  };

  const originalRemove = storage.removeItem.bind(storage);
  storage.removeItem = (key: string) => {
    if (shouldBlockKey(storageName, 'removeItem', key)) {
      return;
    }
    originalRemove(key);
  };

  const originalClear = storage.clear.bind(storage);
  storage.clear = () => {
    warnClear(storageName);
    originalClear();
  };
};

export const applyStorageGuard = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  patchStorage('localStorage', window.localStorage);
  patchStorage('sessionStorage', window.sessionStorage);
};

// ---------------------------------------------------------------------------
// Safe storage helpers (allowed by ESLint only in this file).
// Note: Keys starting with "lexmedical_" are blocked by the guard (PHI policy).
// Use a non-PHI prefix for harmless UI preferences/tools, e.g. "tool_" / "calc_".
// ---------------------------------------------------------------------------

export const storageGetItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
};

export const storageSetItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
};

export const storageRemoveItem = (key: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
};

