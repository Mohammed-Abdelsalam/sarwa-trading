import { createDeviceIdGetter, type KeyValueStorage } from '../src/device';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: jest.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    }),
  } satisfies KeyValueStorage;
}

describe('createDeviceIdGetter', () => {
  it('creates and stores an id the first time', async () => {
    const storage = memoryStorage();
    const getId = createDeviceIdGetter(storage, () => 'new-id');

    await expect(getId()).resolves.toBe('new-id');

    expect(storage.setItem).toHaveBeenCalledWith('sarwa.deviceId', 'new-id');
  });

  it('returns the stored id without creating a new one', async () => {
    const storage = memoryStorage({ 'sarwa.deviceId': 'saved-id' });
    const randomUUID = jest.fn(() => 'unused');
    const getId = createDeviceIdGetter(storage, randomUUID);

    await expect(getId()).resolves.toBe('saved-id');

    expect(randomUUID).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('shares one storage read and write between concurrent calls', async () => {
    const storage = memoryStorage();
    const getId = createDeviceIdGetter(storage, () => 'new-id');

    const ids = await Promise.all([getId(), getId(), getId()]);

    expect(ids).toEqual(['new-id', 'new-id', 'new-id']);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
