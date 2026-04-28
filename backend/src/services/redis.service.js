/**
 * RedisService
 *
 * Redis işlemleri için servis katmanı.
 * getRedisClient() doğrudan servislerde çağrılmaz; her şey bu servis üzerinden geçer.
 *
 * Avantajlar:
 *   - Servislerde raw ioredis bağımlılığı yok → birim testlerde kolayca mock'lanabilir
 *   - Redis'i başka bir cache ile değiştirmek gerekirse sadece bu dosya değişir
 */

class RedisService {
  /**
   * @param {{ getRedisClient: () => import('ioredis').Redis }} deps
   */
  constructor({ getRedisClient }) {
    this._getClient = getRedisClient;
  }

  /** @returns {import('ioredis').Redis} */
  get client() {
    return this._getClient();
  }

  // ── Temel get/set/del ───────────────────────────────────────────────────────

  get(key) {
    return this.client.get(key);
  }

  /**
   * @param {string}  key
   * @param {number}  ttl   — saniye cinsinden
   * @param {string}  value
   */
  setex(key, ttl, value) {
    return this.client.setex(key, ttl, value);
  }

  /**
   * SET komutu — tüm ek argümanlar desteklenir (EX, NX, vb.)
   * Örn: set(key, value, 'EX', 60, 'NX')
   */
  set(...args) {
    return this.client.set(...args);
  }

  del(...keys) {
    return this.client.del(...keys);
  }

  // ── Hash işlemleri ──────────────────────────────────────────────────────────

  hset(key, fields) {
    return this.client.hset(key, fields);
  }

  hgetall(key) {
    return this.client.hgetall(key);
  }

  expire(key, ttl) {
    return this.client.expire(key, ttl);
  }

  // ── Tarama / Pipeline ───────────────────────────────────────────────────────

  /**
   * @returns {import('ioredis').Pipeline}
   */
  pipeline() {
    return this.client.pipeline();
  }

  scan(cursor, ...args) {
    return this.client.scan(cursor, ...args);
  }
}

module.exports = RedisService;

