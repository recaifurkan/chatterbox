const router = require('express').Router();
const { uploadFile } = require('../controllers/upload.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');
const { uploadLimiter } = require('../middlewares/rateLimiter.middleware');

router.post('/', authenticate, uploadLimiter, upload.array('files', 5), uploadFile);

module.exports = router;

