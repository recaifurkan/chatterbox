const router = require('express').Router();
const {
  getMessages, editMessage, deleteMessage, markRead,
  addReaction, removeReaction, getAuditLog,
} = require('../controllers/message.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { messageLimiter } = require('../middlewares/rateLimiter.middleware');

router.use(authenticate);

router.get('/room/:roomId', getMessages);
router.put('/:id', messageLimiter, editMessage);
router.delete('/:id', deleteMessage);
router.post('/room/:roomId/read', markRead);
router.post('/:id/reactions', messageLimiter, addReaction);
router.delete('/:id/reactions/:emoji', removeReaction);
router.get('/:messageId/audit', getAuditLog);

module.exports = router;

