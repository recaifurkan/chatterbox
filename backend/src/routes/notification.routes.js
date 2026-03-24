const router = require('express').Router();
const { getNotifications, markRead, markAllRead, deleteNotification } = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);
router.delete('/:id', deleteNotification);

module.exports = router;

