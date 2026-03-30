const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ALLOWED_MIME_TYPES } = require('../utils/constants');
const logger = require('../utils/logger');

class UploadService {
  /**
   * @param {{
   *   uploadBuffer: Function,
   *   minioClient: Object,
   *   BUCKET: string,
   *   mediaService: import('./media.service')
   * }} deps
   */
  constructor({ uploadBuffer, minioClient, BUCKET, mediaService }) {
    this.uploadBuffer = uploadBuffer;
    this.minioClient = minioClient;
    this.BUCKET = BUCKET;
    this.mediaService = mediaService;
  }

  /**
   * Dosyaları işleyip MinIO'ya yükler ve metadata döner.
   * - Resimler: FFmpeg ile çözünürlük düşürülür ve JPEG'e dönüştürülür
   * - Videolar: FFmpeg ile 720p'ye küçültülür (H.264 + AAC)
   * - Diğer dosyalar: olduğu gibi yüklenir
   */
  async upload(files) {
    return Promise.all(
      files.map(async (file) => {
        let buffer = file.buffer;
        let mimeType = file.mimetype;
        let ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);

        // ── Resim işleme ─────────────────────────────────────────────
        if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
          try {
            buffer = await this.mediaService.processImage(file.buffer);
            mimeType = 'image/jpeg';
            ext = '.jpg';
            logger.info(`Resim işlendi: ${file.originalname} (${file.size} → ${buffer.length} bytes)`);
          } catch (err) {
            logger.warn(`Resim işlenemedi, orijinal yükleniyor: ${file.originalname} — ${err.message}`);
            // İşlenemezse orijinali yükle
          }
        }

        // ── Video işleme ─────────────────────────────────────────────
        if (file.mimetype.startsWith('video/')) {
          try {
            buffer = await this.mediaService.processVideo(file.buffer);
            mimeType = 'video/mp4';
            ext = '.mp4';
            logger.info(`Video işlendi: ${file.originalname} (${file.size} → ${buffer.length} bytes)`);
          } catch (err) {
            logger.warn(`Video işlenemedi, orijinal yükleniyor: ${file.originalname} — ${err.message}`);
          }
        }

        const subDir = mimeType.startsWith('image/') ? 'images'
          : mimeType.startsWith('video/') ? 'videos'
            : 'documents';
        const objectName = `${subDir}/${uuidv4()}${ext}`;

        const url = await this.uploadBuffer(objectName, buffer, mimeType);

        return {
          originalName: file.originalname,
          fileName: path.basename(objectName),
          objectName,
          mimeType,
          size: buffer.length,
          url,
        };
      })
    );
  }

  /**
   * MinIO'daki dosyayı stream olarak döner.
   * @returns {{ stream, contentType, size }}
   */
  async getFileStream(objectName) {
    const stat = await this.minioClient.statObject(this.BUCKET, objectName);
    const contentType = stat.metaData?.['content-type'] || 'application/octet-stream';
    const stream = await this.minioClient.getObject(this.BUCKET, objectName);
    return { stream, contentType, size: stat.size };
  }
}

module.exports = UploadService;

