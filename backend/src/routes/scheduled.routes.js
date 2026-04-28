const router = require('express').Router();
const createScheduledController = require('../controllers/scheduled.controller');
const { schedulerService } = require('../container');
const { authenticate } = require('../container');

const { createScheduledMessage, listScheduledMessages, cancelScheduledMessage } = createScheduledController(schedulerService);

router.use(authenticate);

router.get('/', listScheduledMessages);
router.post('/', createScheduledMessage);
router.delete('/:id', cancelScheduledMessage);

module.exports = router;

