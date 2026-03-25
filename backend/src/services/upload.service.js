const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ALLOWED_MIME_TYPES } = require('../utils/constants');

class UploadService {
  constructor({ uploadBuffer, minioClient, BUCKET }) {
    this.uploadBuffer = uploadBuffer;
    this.minioClient = minioClient;
    this.BUCKET = BUCKET;
  }

  /**
   * Dosyaları MinIO'ya yükler ve metadata döner.
   */
  async upload(files) {
    return Promise.all(
      files.map(async (file) => {
        const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);

        const subDir = file.mimetype.startsWith('image/') ? 'images'
          : file.mimetype.startsWith('video/') ? 'videos'
            : 'documents';
        const objectName = `${subDir}/${uuidv4()}${ext}`;

        const url = await this.uploadBuffer(objectName, file.buffer, file.mimetype);

        return {
          originalName: file.originalname,
          fileName: path.basename(objectName),
          objectName,
          mimeType: file.mimetype,
          size: file.size,
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

