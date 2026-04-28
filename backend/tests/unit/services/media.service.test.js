/**
 * Unit tests for MediaService
 * Mocks child_process.spawn and fs to avoid real FFmpeg/disk I/O.
 */

const { EventEmitter } = require('events');

// ── Mock child_process ────────────────────────────────────────────────────────
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));

// ── Mock fs (avoid real disk I/O) ─────────────────────────────────────────────
const mockWriteFileSync = jest.fn();
const mockReadFileSync = jest.fn().mockReturnValue(Buffer.from('fake-output'));
const mockUnlinkSync = jest.fn();
jest.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  unlinkSync: mockUnlinkSync,
}));

const MediaService = require('../../../src/services/media.service');

/** Build a fake process that emits close(exitCode) after a tick */
function buildProcess({ exitCode = 0, stderrData = '', stdoutData = '' } = {}) {
  const proc = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdout = new EventEmitter();

  setImmediate(() => {
    if (stderrData) proc.stderr.emit('data', Buffer.from(stderrData));
    if (stdoutData) proc.stdout.emit('data', Buffer.from(stdoutData));
    proc.emit('close', exitCode);
  });

  return proc;
}

/** Build a process that emits 'error' event */
function buildErrorProcess(message = 'spawn ENOENT') {
  const proc = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdout = new EventEmitter();

  setImmediate(() => proc.emit('error', new Error(message)));
  return proc;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFileSync.mockReturnValue(Buffer.from('fake-output'));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — constructor', () => {
  it('uses default values when no options provided', () => {
    const svc = new MediaService();
    expect(svc.imageMaxWidth).toBe(1920);
    expect(svc.imageMaxHeight).toBe(1080);
    expect(svc.imageQuality).toBe(5);
    expect(svc.avatarSize).toBe(256);
    expect(svc.videoMaxHeight).toBe(720);
    expect(svc.ffmpegPath).toBe('ffmpeg');
    expect(svc.ffprobePath).toBe('ffprobe');
  });

  it('accepts custom options', () => {
    const svc = new MediaService({ imageMaxWidth: 800, avatarSize: 128, ffmpegPath: '/usr/bin/ffmpeg' });
    expect(svc.imageMaxWidth).toBe(800);
    expect(svc.avatarSize).toBe(128);
    expect(svc.ffmpegPath).toBe('/usr/bin/ffmpeg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — _exec()', () => {
  it('resolves when ffmpeg exits with code 0', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 0 }));
    const svc = new MediaService();
    await expect(svc._exec(['-y', '-i', 'in.jpg', 'out.jpg'])).resolves.toBeUndefined();
  });

  it('rejects when ffmpeg exits with non-zero code', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1, stderrData: 'Invalid data' }));
    const svc = new MediaService();
    await expect(svc._exec(['-y', '-i', 'bad.jpg', 'out.jpg']))
      .rejects.toThrow('FFmpeg exited with code 1');
  });

  it('rejects when spawn emits error event', async () => {
    mockSpawn.mockReturnValue(buildErrorProcess('spawn ENOENT'));
    const svc = new MediaService();
    await expect(svc._exec(['-y'])).rejects.toThrow('FFmpeg spawn failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — processImage()', () => {
  it('writes input, runs ffmpeg, reads output buffer', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const outputBuffer = Buffer.from('jpeg-data');
    mockReadFileSync.mockReturnValue(outputBuffer);

    const svc = new MediaService();
    const result = await svc.processImage(Buffer.from('png-data'));

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.any(Array), expect.any(Object));
    expect(result).toBe(outputBuffer);
  });

  it('cleans up temp files even when ffmpeg fails', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1 }));
    const svc = new MediaService();
    await expect(svc.processImage(Buffer.from('bad-data'))).rejects.toThrow();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('accepts custom maxWidth/maxHeight/quality options', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const svc = new MediaService();
    await svc.processImage(Buffer.from('x'), { maxWidth: 640, maxHeight: 480, quality: 10 });
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('640');
    expect(args.join(' ')).toContain('480');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — processAvatar()', () => {
  it('runs ffmpeg with crop filter and returns buffer', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const avatarBuffer = Buffer.from('avatar-jpeg');
    mockReadFileSync.mockReturnValue(avatarBuffer);

    const svc = new MediaService();
    const result = await svc.processAvatar(Buffer.from('input'), 128);

    expect(result).toBe(avatarBuffer);
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('crop=128:128');
  });

  it('uses default avatar size when not specified', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const svc = new MediaService({ avatarSize: 64 });
    await svc.processAvatar(Buffer.from('input'));
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('crop=64:64');
  });

  it('cleans up temp files on failure', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1 }));
    const svc = new MediaService();
    await expect(svc.processAvatar(Buffer.from('x'))).rejects.toThrow();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — processVideo()', () => {
  it('runs ffmpeg with H.264 encoder and returns buffer', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const videoBuffer = Buffer.from('mp4-data');
    mockReadFileSync.mockReturnValue(videoBuffer);

    const svc = new MediaService();
    const result = await svc.processVideo(Buffer.from('input'));

    expect(result).toBe(videoBuffer);
    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('libx264');
    expect(args).toContain('+faststart');
  });

  it('accepts custom maxHeight option', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const svc = new MediaService();
    await svc.processVideo(Buffer.from('x'), { maxHeight: 480 });
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('480');
  });

  it('cleans up temp files on failure', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1 }));
    const svc = new MediaService();
    await expect(svc.processVideo(Buffer.from('x'))).rejects.toThrow();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — generateThumbnail()', () => {
  it('runs ffmpeg with scale filter and returns buffer', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const thumbBuffer = Buffer.from('thumb-jpeg');
    mockReadFileSync.mockReturnValue(thumbBuffer);

    const svc = new MediaService();
    const result = await svc.generateThumbnail(Buffer.from('video'));

    expect(result).toBe(thumbBuffer);
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('scale=320:-1');
  });

  it('accepts custom width option', async () => {
    mockSpawn.mockReturnValue(buildProcess());
    const svc = new MediaService();
    await svc.generateThumbnail(Buffer.from('x'), { width: 160 });
    const args = mockSpawn.mock.calls[0][1];
    expect(args.join(' ')).toContain('scale=160:-1');
  });

  it('cleans up on failure', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1 }));
    const svc = new MediaService();
    await expect(svc.generateThumbnail(Buffer.from('x'))).rejects.toThrow();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — probe()', () => {
  it('returns parsed JSON metadata from ffprobe', async () => {
    const metadata = { format: { duration: '10.0' }, streams: [] };
    mockSpawn.mockReturnValue(buildProcess({ stdoutData: JSON.stringify(metadata) }));

    const svc = new MediaService();
    const result = await svc.probe(Buffer.from('video'));

    expect(result).toEqual(metadata);
    expect(mockSpawn).toHaveBeenCalledWith('ffprobe', expect.any(Array), expect.any(Object));
  });

  it('uses custom extension for temp file', async () => {
    const metadata = { streams: [] };
    mockSpawn.mockReturnValue(buildProcess({ stdoutData: JSON.stringify(metadata) }));

    const svc = new MediaService();
    await svc.probe(Buffer.from('audio'), '.mp3');
    const writeCall = mockWriteFileSync.mock.calls[0];
    expect(writeCall[0]).toMatch(/\.mp3$/);
  });

  it('rejects when ffprobe exits with non-zero code', async () => {
    mockSpawn.mockReturnValue(buildProcess({ exitCode: 1 }));
    const svc = new MediaService();
    await expect(svc.probe(Buffer.from('bad'))).rejects.toThrow('FFprobe exited');
  });

  it('rejects when ffprobe emits error event', async () => {
    mockSpawn.mockReturnValue(buildErrorProcess('ffprobe ENOENT'));
    const svc = new MediaService();
    await expect(svc.probe(Buffer.from('x'))).rejects.toThrow();
  });

  it('rejects when stdout JSON is invalid', async () => {
    mockSpawn.mockReturnValue(buildProcess({ stdoutData: 'not-json' }));
    const svc = new MediaService();
    await expect(svc.probe(Buffer.from('x'))).rejects.toThrow();
  });

  it('cleans up temp file after probe', async () => {
    mockSpawn.mockReturnValue(buildProcess({ stdoutData: '{}' }));
    const svc = new MediaService();
    await svc.probe(Buffer.from('x'));
    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MediaService — _cleanup()', () => {
  it('silently ignores errors when file does not exist', () => {
    mockUnlinkSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });
    const svc = new MediaService();
    expect(() => svc._cleanup('/nonexistent/path')).not.toThrow();
  });

  it('cleans up multiple files', () => {
    const svc = new MediaService();
    svc._cleanup('/tmp/a', '/tmp/b', '/tmp/c');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(3);
  });
});

