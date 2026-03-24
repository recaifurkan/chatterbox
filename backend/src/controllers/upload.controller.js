const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadBuffer, minioClient, BUCKET } = require('../config/minio');
const { ALLOWED_MIME_TYPES } = require('../utils/constants');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Multer memoryStorage ile gelen dosyaları MinIO'ya yükler.
 * Birden fazla backend node olsa bile MinIO paylaşımlı depolama
 * olduğu için tüm node'lar aynı dosyalara erişebilir.
 */
async function uploadFile(req, res, next) {
  try {
    if (!req.files?.length && !req.file) {
      return errorResponse(res, 'Dosya bulunamadı', 400);
    }

    const files = req.files?.length ? req.files : [req.file];

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);

        // MinIO nesne yolu: "images/uuid.jpg", "videos/uuid.mp4", "documents/uuid.pdf"
        const subDir = file.mimetype.startsWith('image/')  ? 'images'
                     : file.mimetype.startsWith('video/')  ? 'videos'
                     : 'documents';
        const objectName = `${subDir}/${uuidv4()}${ext}`;

        const url = await uploadBuffer(objectName, file.buffer, file.mimetype);

        return {
          originalName: file.originalname,
          fileName:     path.basename(objectName),
          objectName,
          mimeType:     file.mimetype,
          size:         file.size,
          url,
        };
      })
    );

    return successResponse(res, { files: uploaded }, 'Dosya(lar) yüklendi');
  } catch (error) {
    next(error);
  }
}

/**
 * MinIO'daki dosyayı backend üzerinden istemciye stream eder.
 * Kimlik doğrulaması gerekmez; URL'ler UUID tabanlı olduğundan tahmin edilemez.
 * GET /api/v1/files/:objectName  (örn: images/uuid.jpg, videos/uuid.mp4)
 */
async function serveFile(req, res, next) {
  try {
    // Express wildcard route'u params[0] olarak verir
    const objectName = req.params[0];
    if (!objectName) return res.status(400).json({ success: false, message: 'Geçersiz dosya yolu' });

    let stat;
    try {
      stat = await minioClient.statObject(BUCKET, objectName);
    } catch {
      return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    }

    const contentType = stat.metaData?.['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = await minioClient.getObject(BUCKET, objectName);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadFile, serveFile };
