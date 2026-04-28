const router = require('express').Router();
const createMessageController = require('../controllers/message.controller');
const { messageService } = require('../container');
const { authenticate } = require('../container');

const { searchMessages } = createMessageController(messageService);

router.use(authenticate);
router.get('/messages', searchMessages);

module.exports = router;

