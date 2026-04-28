/**
 * Unit tests for LiveKitService
 */
const LiveKitService = require('../../../src/services/livekit.service');

beforeEach(() => {
  process.env.LIVEKIT_API_KEY = 'testkey';
  process.env.LIVEKIT_API_SECRET = 'testsecret01234567890123456789012345';
  process.env.LIVEKIT_SERVER_COUNT = '3';
});

afterEach(() => {
  delete process.env.LIVEKIT_SERVER_COUNT;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveKitService — constructor', () => {
  it('reads LIVEKIT_SERVER_COUNT from env', () => {
    const svc = new LiveKitService();
    expect(svc.serverCount).toBe(3);
  });

  it('defaults serverCount to 2 when env not set', () => {
    delete process.env.LIVEKIT_SERVER_COUNT;
    const svc = new LiveKitService();
    expect(svc.serverCount).toBe(2);
  });

  it('reads api key and secret from env', () => {
    const svc = new LiveKitService();
    expect(svc.apiKey).toBe('testkey');
    expect(svc.apiSecret).toBe('testsecret01234567890123456789012345');
  });

  it('uses default values when env not set', () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    const svc = new LiveKitService();
    expect(svc.apiKey).toBe('devkey');
    expect(svc.apiSecret).toBe('devsecret');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveKitService — pickServer()', () => {
  it('starts at 1 on first call', () => {
    const svc = new LiveKitService();
    expect(svc.pickServer()).toBe(1);
  });

  it('increments on subsequent calls', () => {
    const svc = new LiveKitService();
    expect(svc.pickServer()).toBe(1);
    expect(svc.pickServer()).toBe(2);
    expect(svc.pickServer()).toBe(3);
  });

  it('wraps around after serverCount', () => {
    const svc = new LiveKitService(); // serverCount = 3
    svc.pickServer(); // 1
    svc.pickServer(); // 2
    svc.pickServer(); // 3
    expect(svc.pickServer()).toBe(1); // wraps
  });

  it('round-robin distributes across all servers', () => {
    process.env.LIVEKIT_SERVER_COUNT = '2';
    const svc = new LiveKitService();
    const picks = Array.from({ length: 6 }, () => svc.pickServer());
    expect(picks).toEqual([1, 2, 1, 2, 1, 2]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LiveKitService — generateToken()', () => {
  it('returns a non-empty JWT string', async () => {
    const svc = new LiveKitService();
    const token = await svc.generateToken('user123', 'Alice', 'call-abc');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    // JWT has 3 parts separated by dots
    expect(token.split('.').length).toBe(3);
  });

  it('generates different tokens for different users', async () => {
    const svc = new LiveKitService();
    const t1 = await svc.generateToken('user1', 'Alice', 'call-xyz');
    const t2 = await svc.generateToken('user2', 'Bob', 'call-xyz');
    expect(t1).not.toBe(t2);
  });

  it('accepts extra grants without throwing', async () => {
    const svc = new LiveKitService();
    await expect(
      svc.generateToken('user1', 'Alice', 'call-test', { canPublish: false })
    ).resolves.toBeDefined();
  });

  it('generates different tokens for different rooms', async () => {
    const svc = new LiveKitService();
    const t1 = await svc.generateToken('user1', 'Alice', 'room-A');
    const t2 = await svc.generateToken('user1', 'Alice', 'room-B');
    expect(t1).not.toBe(t2);
  });
});

