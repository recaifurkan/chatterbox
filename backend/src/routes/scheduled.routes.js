const router = require('express').Router();
const { createScheduledMessage, listScheduledMessages, cancelScheduledMessage } = require('../controllers/scheduled.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', listScheduledMessages);
router.post('/', createScheduledMessage);
router.delete('/:id', cancelScheduledMessage);

module.exports = router;

