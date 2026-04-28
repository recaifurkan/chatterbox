/**
 * MinIO Storage Provider
 *
 * Standart StorageProvider interface'ini implemente eder.
 * S3'e geçmek için bu dosyayı s3.provider.js ile değiştirmek yeterlidir.
 *
 * Interface:
 *   upload(objectName, buffer, mimeType)  → Promise<string>  (relative URL)
 *   getStream(objectName)                 → Promise<{ stream, contentType, size }>
 *   delete(objectName)                    → Promise<void>
 *   extractObjectName(url)                → string | null
 */

const { Readable } = require('stream');
const Minio = require('minio');
const logger = require('../../utils/logger');

class MinioStorageProvider {
  /**
   * @param {{
   *   endPoint:  string,
   *   port:      number,
   *   useSSL:    boolean,
   *   accessKey: string,
   *   secretKey: string,
   *   bucket:    string,
   * }} config
   */
  constructor({ endPoint, port, useSSL, accessKey, secretKey, bucket }) {
    this.bucket = bucket;
    this.client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });
  }

  /** Bucket mevcut değilse oluşturur. Uygulama başlangıcında çağrılır. */
  async init({ maxRetries = 10, retryDelay = 3000 } = {}) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          await this.client.makeBucket(this.bucket, 'us-east-1');
          logger.info(`MinIO: Bucket "${this.bucket}" oluşturuldu (private)`);
        }
        logger.info(`✅ MinIO bağlandı → bucket: ${this.bucket}`);
        return;
      } catch (err) {
        if (attempt === maxRetries) {
          throw new Error(`MinIO bağlantısı başarısız (${maxRetries} deneme): ${err.message}`);
        }
        logger.warn(`MinIO bağlantı denemesi ${attempt}/${maxRetries} başarısız. ${retryDelay / 1000}s sonra tekrar...`);
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }

  /**
   * Buffer'ı MinIO'ya yükler.
   * @returns {Promise<string>} Backend proxy URL'i (/api/v1/files/<objectName>)
   */
  async upload(objectName, buffer, mimeType) {
    const stream = Readable.from(buffer);
    await this.client.putObject(this.bucket, objectName, stream, buffer.length, {
      'Content-Type': mimeType,
    });
    return `/api/v1/files/${objectName}`;
  }

  /**
   * Nesneyi stream olarak döner.
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, size: number }>}
   */
  async getStream(objectName) {
    const stat = await this.client.statObject(this.bucket, objectName);
    const contentType = stat.metaData?.['content-type'] || 'application/octet-stream';
    const stream = await this.client.getObject(this.bucket, objectName);
    return { stream, contentType, size: stat.size };
  }

  /**
   * Nesneyi MinIO'dan siler.
   */
  async delete(objectName) {
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (err) {
      logger.warn(`MinIO nesne silinemedi: ${objectName} — ${err.message}`);
    }
  }

  /**
   * Herhangi bir URL formatından MinIO object name'ini çıkarır.
   * Desteklenen formatlar:
   *   /api/v1/files/images/abc.jpg          → images/abc.jpg
   *   /storage/chat-uploads/images/abc.jpg  → images/abc.jpg  (eski format)
   *   http://localhost/storage/.../...      → images/abc.jpg  (eski format)
   */
  extractObjectName(url) {
    if (!url) return null;

    const apiPrefix = '/api/v1/files/';
    if (url.startsWith(apiPrefix)) {
      return url.substring(apiPrefix.length);
    }

    const marker = `/${this.bucket}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return url.substring(idx + marker.length);
    }

    return null;
  }
}

module.exports = MinioStorageProvider;

