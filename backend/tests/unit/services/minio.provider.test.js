/**
 * Unit tests for MinioStorageProvider
 */

// mock-prefixed variables are hoisted safely by Jest
const mockBucketExists = jest.fn();
const mockMakeBucket = jest.fn();
const mockPutObject = jest.fn();
const mockStatObject = jest.fn();
const mockGetObject = jest.fn();
const mockRemoveObject = jest.fn();

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: mockBucketExists,
    makeBucket: mockMakeBucket,
    putObject: mockPutObject,
    statObject: mockStatObject,
    getObject: mockGetObject,
    removeObject: mockRemoveObject,
  })),
}));

const MinioStorageProvider = require('../../../src/services/storage/minio.provider');

const CONFIG = {
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'testkey',
  secretKey: 'testsecret',
  bucket: 'test-bucket',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — constructor', () => {
  it('sets bucket and creates minio client', () => {
    const provider = new MinioStorageProvider(CONFIG);
    expect(provider.bucket).toBe('test-bucket');
    expect(provider.client).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — init()', () => {
  it('connects and skips bucket creation when bucket already exists', async () => {
    mockBucketExists.mockResolvedValue(true);
    const provider = new MinioStorageProvider(CONFIG);
    await provider.init();
    expect(mockBucketExists).toHaveBeenCalledWith('test-bucket');
    expect(mockMakeBucket).not.toHaveBeenCalled();
  });

  it('creates bucket when it does not exist', async () => {
    mockBucketExists.mockResolvedValue(false);
    mockMakeBucket.mockResolvedValue(undefined);
    const provider = new MinioStorageProvider(CONFIG);
    await provider.init();
    expect(mockMakeBucket).toHaveBeenCalledWith('test-bucket', 'us-east-1');
  });

  it('retries on transient failure and succeeds eventually', async () => {
    mockBucketExists
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(true);

    const provider = new MinioStorageProvider(CONFIG);
    await provider.init({ maxRetries: 3, retryDelay: 1 });
    expect(mockBucketExists).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    mockBucketExists.mockRejectedValue(new Error('always fails'));
    const provider = new MinioStorageProvider(CONFIG);
    await expect(provider.init({ maxRetries: 2, retryDelay: 1 }))
      .rejects.toThrow('MinIO bağlantısı başarısız');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — upload()', () => {
  it('puts object and returns proxy URL', async () => {
    mockPutObject.mockResolvedValue(undefined);
    const provider = new MinioStorageProvider(CONFIG);
    const buf = Buffer.from('hello');
    const url = await provider.upload('images/test.jpg', buf, 'image/jpeg');
    expect(mockPutObject).toHaveBeenCalledWith(
      'test-bucket',
      'images/test.jpg',
      expect.anything(), // Readable stream
      buf.length,
      { 'Content-Type': 'image/jpeg' },
    );
    expect(url).toBe('/api/v1/files/images/test.jpg');
  });

  it('propagates putObject errors', async () => {
    mockPutObject.mockRejectedValue(new Error('storage error'));
    const provider = new MinioStorageProvider(CONFIG);
    await expect(provider.upload('images/x.jpg', Buffer.from('x'), 'image/jpeg'))
      .rejects.toThrow('storage error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — getStream()', () => {
  it('returns stream, contentType and size', async () => {
    const fakeStream = { pipe: jest.fn() };
    mockStatObject.mockResolvedValue({
      size: 512,
      metaData: { 'content-type': 'image/png' },
    });
    mockGetObject.mockResolvedValue(fakeStream);

    const provider = new MinioStorageProvider(CONFIG);
    const result = await provider.getStream('images/test.png');
    expect(result.contentType).toBe('image/png');
    expect(result.size).toBe(512);
    expect(result.stream).toBe(fakeStream);
  });

  it('defaults to application/octet-stream when content-type metadata missing', async () => {
    mockStatObject.mockResolvedValue({ size: 100, metaData: {} });
    mockGetObject.mockResolvedValue({});
    const provider = new MinioStorageProvider(CONFIG);
    const result = await provider.getStream('docs/file.bin');
    expect(result.contentType).toBe('application/octet-stream');
  });

  it('propagates statObject errors', async () => {
    mockStatObject.mockRejectedValue(new Error('Not Found'));
    const provider = new MinioStorageProvider(CONFIG);
    await expect(provider.getStream('missing.jpg')).rejects.toThrow('Not Found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — delete()', () => {
  it('removes object successfully', async () => {
    mockRemoveObject.mockResolvedValue(undefined);
    const provider = new MinioStorageProvider(CONFIG);
    await expect(provider.delete('images/test.jpg')).resolves.toBeUndefined();
    expect(mockRemoveObject).toHaveBeenCalledWith('test-bucket', 'images/test.jpg');
  });

  it('swallows removeObject errors (only logs warning)', async () => {
    mockRemoveObject.mockRejectedValue(new Error('object not found'));
    const provider = new MinioStorageProvider(CONFIG);
    // Should NOT throw
    await expect(provider.delete('nonexistent.jpg')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MinioStorageProvider — extractObjectName()', () => {
  let provider;
  beforeEach(() => { provider = new MinioStorageProvider(CONFIG); });

  it('extracts object name from new /api/v1/files/ format', () => {
    expect(provider.extractObjectName('/api/v1/files/images/abc.jpg'))
      .toBe('images/abc.jpg');
  });

  it('extracts object name from old /storage/<bucket>/ format', () => {
    expect(provider.extractObjectName('/storage/test-bucket/documents/file.pdf'))
      .toBe('documents/file.pdf');
  });

  it('extracts object name from full http URL (old format)', () => {
    expect(provider.extractObjectName('http://localhost:9000/storage/test-bucket/avatars/user.jpg'))
      .toBe('avatars/user.jpg');
  });

  it('returns null for null input', () => {
    expect(provider.extractObjectName(null)).toBeNull();
  });

  it('returns null for unrecognized URL format', () => {
    expect(provider.extractObjectName('https://example.com/some/path')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(provider.extractObjectName('')).toBeNull();
  });
});

