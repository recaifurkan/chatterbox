/**
 * Unit tests for FilesystemService
 */
const FilesystemService = require('../../../src/services/filesystem.service');

function makeProvider(overrides = {}) {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue('/api/v1/files/test/file.jpg'),
    getStream: jest.fn().mockResolvedValue({ stream: {}, contentType: 'image/jpeg', size: 100 }),
    delete: jest.fn().mockResolvedValue(undefined),
    extractObjectName: jest.fn().mockReturnValue('test/file.jpg'),
    ...overrides,
  };
}

describe('FilesystemService — constructor', () => {
  it('stores the provided storageProvider', () => {
    const provider = makeProvider();
    const svc = new FilesystemService({ storageProvider: provider });
    expect(svc.provider).toBe(provider);
  });
});

describe('FilesystemService — init()', () => {
  it('delegates to provider.init() without options', async () => {
    const provider = makeProvider();
    const svc = new FilesystemService({ storageProvider: provider });
    await svc.init();
    expect(provider.init).toHaveBeenCalledWith(undefined);
  });

  it('delegates to provider.init() with options', async () => {
    const provider = makeProvider();
    const svc = new FilesystemService({ storageProvider: provider });
    const opts = { maxRetries: 5, retryDelay: 1000 };
    await svc.init(opts);
    expect(provider.init).toHaveBeenCalledWith(opts);
  });

  it('propagates provider init errors', async () => {
    const provider = makeProvider({ init: jest.fn().mockRejectedValue(new Error('conn failed')) });
    const svc = new FilesystemService({ storageProvider: provider });
    await expect(svc.init()).rejects.toThrow('conn failed');
  });
});

describe('FilesystemService — upload()', () => {
  it('delegates to provider.upload() and returns URL', async () => {
    const provider = makeProvider();
    const svc = new FilesystemService({ storageProvider: provider });
    const buf = Buffer.from('data');
    const url = await svc.upload('images/test.jpg', buf, 'image/jpeg');
    expect(provider.upload).toHaveBeenCalledWith('images/test.jpg', buf, 'image/jpeg');
    expect(url).toBe('/api/v1/files/test/file.jpg');
  });

  it('propagates provider upload errors', async () => {
    const provider = makeProvider({ upload: jest.fn().mockRejectedValue(new Error('upload fail')) });
    const svc = new FilesystemService({ storageProvider: provider });
    await expect(svc.upload('x', Buffer.from(''), 'text/plain')).rejects.toThrow('upload fail');
  });
});

describe('FilesystemService — getStream()', () => {
  it('delegates to provider.getStream() and returns result', async () => {
    const streamResult = { stream: { pipe: jest.fn() }, contentType: 'video/mp4', size: 2048 };
    const provider = makeProvider({ getStream: jest.fn().mockResolvedValue(streamResult) });
    const svc = new FilesystemService({ storageProvider: provider });
    const result = await svc.getStream('videos/clip.mp4');
    expect(provider.getStream).toHaveBeenCalledWith('videos/clip.mp4');
    expect(result).toBe(streamResult);
  });

  it('propagates provider getStream errors', async () => {
    const provider = makeProvider({ getStream: jest.fn().mockRejectedValue(new Error('not found')) });
    const svc = new FilesystemService({ storageProvider: provider });
    await expect(svc.getStream('missing.jpg')).rejects.toThrow('not found');
  });
});

describe('FilesystemService — delete()', () => {
  it('delegates to provider.delete()', async () => {
    const provider = makeProvider();
    const svc = new FilesystemService({ storageProvider: provider });
    await svc.delete('images/old.jpg');
    expect(provider.delete).toHaveBeenCalledWith('images/old.jpg');
  });

  it('propagates provider delete errors', async () => {
    const provider = makeProvider({ delete: jest.fn().mockRejectedValue(new Error('del fail')) });
    const svc = new FilesystemService({ storageProvider: provider });
    await expect(svc.delete('x')).rejects.toThrow('del fail');
  });
});

describe('FilesystemService — extractObjectName()', () => {
  it('delegates to provider.extractObjectName() and returns result', () => {
    const provider = makeProvider({ extractObjectName: jest.fn().mockReturnValue('avatars/user.jpg') });
    const svc = new FilesystemService({ storageProvider: provider });
    const result = svc.extractObjectName('/api/v1/files/avatars/user.jpg');
    expect(provider.extractObjectName).toHaveBeenCalledWith('/api/v1/files/avatars/user.jpg');
    expect(result).toBe('avatars/user.jpg');
  });

  it('returns null when provider returns null', () => {
    const provider = makeProvider({ extractObjectName: jest.fn().mockReturnValue(null) });
    const svc = new FilesystemService({ storageProvider: provider });
    expect(svc.extractObjectName('https://example.com/unknown')).toBeNull();
  });
});

