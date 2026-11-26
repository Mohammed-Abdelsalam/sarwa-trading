export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const DEVICE_ID_KEY = 'sarwa.deviceId';

export function createDeviceIdGetter(
  storage: KeyValueStorage,
  randomUUID: () => string,
): () => Promise<string> {
  let pending: Promise<string> | undefined;
  return () =>
    (pending ??= (async () => {
      const existing = await storage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = randomUUID();
      await storage.setItem(DEVICE_ID_KEY, id);
      return id;
    })());
}
