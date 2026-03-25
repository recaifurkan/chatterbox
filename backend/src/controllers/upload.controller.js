const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @param {import('../services/upload.service')} uploadService
 */
function createUploadController(uploadService) {
  async function uploadFile(req, res, next) {
    try {
      if (!req.files?.length && !req.file) {
        return errorResponse(res, 'Dosya bulunamadı', 400);
      }

      const files = req.files?.length ? req.files : [req.file];
      const uploaded = await uploadService.upload(files);

      return successResponse(res, { files: uploaded }, 'Dosya(lar) yüklendi');
    } catch (error) {
      next(error);
    }
  }

  async function serveFile(req, res, next) {
    try {
      const objectName = req.params[0];
      if (!objectName) return res.status(400).json({ success: false, message: 'Geçersiz dosya yolu' });

      let fileData;
      try {
        fileData = await uploadService.getFileStream(objectName);
      } catch {
        return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
      }

      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Length', fileData.size);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Accept-Ranges', 'bytes');

      fileData.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  return { uploadFile, serveFile };
}

module.exports = createUploadController;
