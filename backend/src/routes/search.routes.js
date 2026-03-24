const router = require('express').Router();
const { searchMessages } = require('../controllers/message.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/messages', searchMessages);

module.exports = router;

