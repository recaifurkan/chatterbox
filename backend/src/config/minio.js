const Minio = require('minio');
const logger = require('../utils/logger');

const BUCKET = process.env.MINIO_BUCKET || 'chat-uploads';

const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT) || 9000,
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

/**
 * Bucket'ı oluşturur (yoksa).
 * Public-read policy KALDIRILDI — dosyalar yalnızca backend üzerinden erişilebilir.
 */
async function initMinIO() {
  const MAX_RETRIES = 10;
  const DELAY = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const exists = await minioClient.bucketExists(BUCKET);
      if (!exists) {
        await minioClient.makeBucket(BUCKET, 'us-east-1');
        logger.info(`MinIO: Bucket "${BUCKET}" oluşturuldu (private)`);
      }
      logger.info(`✅ MinIO bağlandı → ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}, bucket: ${BUCKET}`);
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`MinIO bağlantısı başarısız (${MAX_RETRIES} deneme): ${err.message}`);
      }
      logger.warn(`MinIO bağlantı denemesi ${attempt}/${MAX_RETRIES} başarısız. ${DELAY / 1000}s sonra tekrar...`);
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }
}

/**
 * Bir Buffer'ı MinIO'ya yükler ve backend proxy URL'ini döndürür.
 * URL her zaman /api/v1/files/<objectName> formatındadır —
 * hem localhost hem de ağdaki herhangi bir IP'den çalışır.
 */
async function uploadBuffer(objectName, buffer, mimeType) {
  const { Readable } = require('stream');
  const stream = Readable.from(buffer);
  await minioClient.putObject(BUCKET, objectName, stream, buffer.length, {
    'Content-Type': mimeType,
  });
  return `/api/v1/files/${objectName}`;
}

/**
 * MinIO'dan bir nesneyi siler.
 */
async function deleteObject(objectName) {
  try {
    await minioClient.removeObject(BUCKET, objectName);
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
function extractObjectName(publicUrl) {
  if (!publicUrl) return null;

  // Yeni format
  const apiPrefix = '/api/v1/files/';
  if (publicUrl.startsWith(apiPrefix)) {
    return publicUrl.substring(apiPrefix.length);
  }

  // Eski format (/storage/... veya http://host/storage/...)
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx !== -1) {
    return publicUrl.substring(idx + marker.length);
  }

  return null;
}

module.exports = { minioClient, BUCKET, initMinIO, uploadBuffer, deleteObject, extractObjectName };

