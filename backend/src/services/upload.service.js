const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ALLOWED_MIME_TYPES } = require('../utils/constants');
const logger = require('../utils/logger');

class UploadService {
  /**
   * @param {{
   *   filesystemService: import('./filesystem.service'),
   *   mediaService: import('./media.service')
   * }} deps
   */
  constructor({ filesystemService, mediaService }) {
    this.filesystemService = filesystemService;
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

        const url = await this.filesystemService.upload(objectName, buffer, mimeType);

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
   * Depolama alanındaki dosyayı stream olarak döner.
   * @returns {{ stream, contentType, size }}
   */
  async getFileStream(objectName) {
    return this.filesystemService.getStream(objectName);
  }
}

module.exports = UploadService;

