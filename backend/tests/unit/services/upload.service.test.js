/**
 * Unit tests for UploadService
 */
const UploadService = require('../../../src/services/upload.service');

function makeFilesystemService(overrides = {}) {
  return {
    upload: jest.fn().mockResolvedValue('/api/v1/files/images/test.jpg'),
    getStream: jest.fn().mockResolvedValue({ stream: {}, contentType: 'image/jpeg', size: 100 }),
    ...overrides,
  };
}

function makeMediaService(overrides = {}) {
  return {
    processImage: jest.fn().mockResolvedValue(Buffer.from('processed-image')),
    processVideo: jest.fn().mockResolvedValue(Buffer.from('processed-video')),
    ...overrides,
  };
}

function makeFile(overrides = {}) {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('raw-data'),
    size: 8,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('UploadService — upload() images', () => {
  it('processes image and uploads as JPEG', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService();
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const processed = Buffer.from('processed-jpeg');
    media.processImage.mockResolvedValue(processed);
    fs.upload.mockResolvedValue('/api/v1/files/images/out.jpg');

    const [result] = await svc.upload([makeFile()]);

    expect(media.processImage).toHaveBeenCalledWith(Buffer.from('raw-data'));
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.url).toBe('/api/v1/files/images/out.jpg');
    expect(result.size).toBe(processed.length);
  });

  it('falls back to original buffer when image processing fails', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService({
      processImage: jest.fn().mockRejectedValue(new Error('sharp error')),
    });
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const file = makeFile();
    const [result] = await svc.upload([file]);

    // mimeType stays as original, buffer stays as original
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.size).toBe(file.buffer.length);
    expect(fs.upload).toHaveBeenCalled();
  });

  it('passes GIF through without processing', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService();
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const file = makeFile({ mimetype: 'image/gif', originalname: 'anim.gif' });
    await svc.upload([file]);

    expect(media.processImage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UploadService — upload() videos', () => {
  it('processes video and uploads as MP4', async () => {
    const fs = makeFilesystemService({ upload: jest.fn().mockResolvedValue('/api/v1/files/videos/out.mp4') });
    const processedVid = Buffer.from('processed-video-data');
    const media = makeMediaService({ processVideo: jest.fn().mockResolvedValue(processedVid) });
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const file = makeFile({ mimetype: 'video/mp4', originalname: 'clip.mp4' });
    const [result] = await svc.upload([file]);

    expect(media.processVideo).toHaveBeenCalled();
    expect(result.mimeType).toBe('video/mp4');
    expect(result.size).toBe(processedVid.length);
    expect(result.url).toBe('/api/v1/files/videos/out.mp4');
  });

  it('falls back to original buffer when video processing fails', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService({
      processVideo: jest.fn().mockRejectedValue(new Error('ffmpeg error')),
    });
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const file = makeFile({ mimetype: 'video/mp4', originalname: 'clip.mp4' });
    const [result] = await svc.upload([file]);

    expect(result.mimeType).toBe('video/mp4');
    expect(result.size).toBe(file.buffer.length);
    expect(fs.upload).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UploadService — upload() documents', () => {
  it('uploads PDF without processing', async () => {
    const fs = makeFilesystemService({ upload: jest.fn().mockResolvedValue('/api/v1/files/documents/doc.pdf') });
    const media = makeMediaService();
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const file = makeFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' });
    const [result] = await svc.upload([file]);

    expect(media.processImage).not.toHaveBeenCalled();
    expect(media.processVideo).not.toHaveBeenCalled();
    expect(result.mimeType).toBe('application/pdf');
    expect(result.url).toBe('/api/v1/files/documents/doc.pdf');
  });

  it('returns correct metadata structure', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService();
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const [result] = await svc.upload([makeFile()]);

    expect(result).toHaveProperty('originalName');
    expect(result).toHaveProperty('fileName');
    expect(result).toHaveProperty('objectName');
    expect(result).toHaveProperty('mimeType');
    expect(result).toHaveProperty('size');
    expect(result).toHaveProperty('url');
  });

  it('handles multiple files concurrently', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService();
    const svc = new UploadService({ filesystemService: fs, mediaService: media });

    const files = [
      makeFile({ originalname: 'a.jpg', mimetype: 'image/jpeg' }),
      makeFile({ originalname: 'b.pdf', mimetype: 'application/pdf' }),
    ];
    const results = await svc.upload(files);
    expect(results).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UploadService — getFileStream()', () => {
  it('delegates to filesystemService.getStream()', async () => {
    const streamResult = { stream: {}, contentType: 'image/png', size: 256 };
    const fs = makeFilesystemService({ getStream: jest.fn().mockResolvedValue(streamResult) });
    const svc = new UploadService({ filesystemService: fs, mediaService: makeMediaService() });

    const result = await svc.getFileStream('images/photo.png');
    expect(fs.getStream).toHaveBeenCalledWith('images/photo.png');
    expect(result).toBe(streamResult);
  });

  it('propagates getStream errors', async () => {
    const fs = makeFilesystemService({ getStream: jest.fn().mockRejectedValue(new Error('not found')) });
    const svc = new UploadService({ filesystemService: fs, mediaService: makeMediaService() });
    await expect(svc.getFileStream('missing.jpg')).rejects.toThrow('not found');
  });
});

