const router = require('express').Router();
const createUploadController = require('../controllers/upload.controller');
const { uploadService } = require('../container');
const { authenticate } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');
const { uploadLimiter } = require('../middlewares/rateLimiter.middleware');

const { uploadFile } = createUploadController(uploadService);

router.post('/', authenticate, uploadLimiter, upload.array('files', 5), uploadFile);

module.exports = router;

