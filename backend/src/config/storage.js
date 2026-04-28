/**
 * Storage Konfigürasyonu
 *
 * Aktif storage provider'ı oluşturur ve dışa açar.
 * S3'e geçmek için: MinioStorageProvider yerine S3StorageProvider'ı import edip
 * aynı interface ile konfigüre edin — başka hiçbir dosya değişmez.
 */

const MinioStorageProvider = require('../services/storage/minio.provider');

const storageProvider = new MinioStorageProvider({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT) || 9000,
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  bucket:    process.env.MINIO_BUCKET    || 'chat-uploads',
});

module.exports = { storageProvider };
