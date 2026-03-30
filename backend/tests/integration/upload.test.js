/**
 * Integration tests for Upload controller
 */
const request = require('supertest');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser,
} = require('../helpers/setup');

let mockRedisInstance;
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Mock MinIO
const mockUploadBuffer = jest.fn().mockResolvedValue('/api/v1/files/images/test-uuid.jpg');
const mockStatObject = jest.fn();
const mockGetObject = jest.fn();

jest.mock('../../src/config/minio', () => ({
  uploadBuffer: mockUploadBuffer,
  deleteObject: jest.fn().mockResolvedValue(undefined),
  extractObjectName: jest.fn().mockReturnValue(null),
  ensureBucket: jest.fn().mockResolvedValue(undefined),
  minioClient: {
    statObject: mockStatObject,
    getObject: mockGetObject,
  },
  BUCKET: 'chat-uploads',
}));

jest.mock('../../src/config/socket', () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }),
  initSocket: jest.fn(),
}));

jest.mock('../../src/services/media.service', () => {
  return jest.fn().mockImplementation(() => ({
    processAvatar: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
    processImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
    processVideo: jest.fn().mockResolvedValue(Buffer.from('fake-video')),
    generateThumbnail: jest.fn().mockResolvedValue(Buffer.from('fake-thumb')),
    probe: jest.fn().mockResolvedValue({}),
  }));
});

const app = require('../../src/app');

beforeAll(async () => {
  setTestEnv();
  const RedisMock = require('ioredis-mock');
  mockRedisInstance = new RedisMock();
  await connectDB();
});

afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  await mockRedisInstance.flushall();
  jest.clearAllMocks();
});

describe('POST /api/v1/upload', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/upload');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('uploads an image file successfully', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    mockUploadBuffer.mockResolvedValueOnce('/api/v1/files/images/test.jpg');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('fake image'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.data.files).toHaveLength(1);
    expect(res.body.data.files[0].mimeType).toBe('image/jpeg');
  });

  it('uploads a PDF document successfully', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    mockUploadBuffer.mockResolvedValueOnce('/api/v1/files/documents/test.pdf');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('%PDF-1.4 fake'), { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.data.files[0].mimeType).toBe('application/pdf');
  });

  it('rejects disallowed MIME types', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('exec'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });

    // multer fileFilter rejects → 400 or passes through → 200 with no files → 400
    expect([400, 500]).toContain(res.status);
  });
});

describe('GET /api/v1/files/*', () => {
  it('returns 400 for empty path', async () => {
    const res = await request(app).get('/api/v1/files/');
    // Express may return 404 for truly empty paths depending on routing
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 when object does not exist in MinIO', async () => {
    mockStatObject.mockRejectedValueOnce(new Error('Not Found'));

    const res = await request(app).get('/api/v1/files/images/nonexistent.jpg');
    expect(res.status).toBe(404);
  });

  it('returns correct content-type headers for existing file', async () => {
    // We test the serveFile header-setting path by mocking statObject success
    // and returning a stream that immediately ends (avoids pipe/abort race)
    const { Readable } = require('stream');
    const fakeStream = new Readable({
      read() {
        this.push('fake content');
        this.push(null); // end immediately
      },
    });

    mockStatObject.mockResolvedValueOnce({
      size: 12,
      metaData: { 'content-type': 'image/jpeg' },
    });
    mockGetObject.mockResolvedValueOnce(fakeStream);

    const res = await request(app).get('/api/v1/files/images/test.jpg').buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });
});



