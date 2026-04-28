const router = require('express').Router();
const createNotificationController = require('../controllers/notification.controller');
const { notificationService } = require('../container');
const { authenticate } = require('../container');

const { getNotifications, markRead, markAllRead, deleteNotification } = createNotificationController(notificationService);

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);
router.delete('/:id', deleteNotification);

module.exports = router;

