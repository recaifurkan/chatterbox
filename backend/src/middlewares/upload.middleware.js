const multer = require('multer');
const { ALLOWED_MIME_TYPES } = require('../utils/constants');

// Memory storage: dosya diske yazılmaz, Buffer olarak req.file.buffer'a gelir.
// MinIO'ya stream edilmek üzere bellekte tutulur.
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Dosya tipi desteklenmiyor: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 25 * 1024 * 1024, // 25 MB
    files: 5,
  },
});

// Avatar upload (sadece resimler, 5 MB)
const avatarUpload = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Avatar için sadece resim dosyası yüklenebilir'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { upload, avatarUpload };
