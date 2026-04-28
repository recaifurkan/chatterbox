const router = require('express').Router();
const createMessageController = require('../controllers/message.controller');
const { messageService } = require('../container');
const { authenticate } = require('../container');
const { messageLimiter } = require('../middlewares/rateLimiter.middleware');

const {
  getMessages, editMessage, deleteMessage, markRead,
  addReaction, removeReaction, getAuditLog,
} = createMessageController(messageService);

router.use(authenticate);

router.get('/room/:roomId', getMessages);
router.put('/:id', messageLimiter, editMessage);
router.delete('/:id', deleteMessage);
router.post('/room/:roomId/read', markRead);
router.post('/:id/reactions', messageLimiter, addReaction);
router.delete('/:id/reactions/:emoji', removeReaction);
router.get('/:messageId/audit', getAuditLog);

module.exports = router;

