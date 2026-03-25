const { successResponse } = require('../utils/apiResponse');

/**
 * @param {import('../services/notification.service')} notificationService
 */
function createNotificationController(notificationService) {
  async function getNotifications(req, res, next) {
    try {
      const { page = 1, limit = 20, unread } = req.query;
      const { notifications, unreadCount } = await notificationService.getNotifications(
        req.user._id, { page, limit, unread }
      );
      return successResponse(res, { notifications, unreadCount });
    } catch (error) {
      next(error);
    }
  }

  async function markRead(req, res, next) {
    try {
      await notificationService.markRead(req.params.id, req.user._id);
      return successResponse(res, null, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  async function markAllRead(req, res, next) {
    try {
      await notificationService.markAllRead(req.user._id);
      return successResponse(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async function deleteNotification(req, res, next) {
    try {
      await notificationService.deleteNotification(req.params.id, req.user._id);
      return successResponse(res, null, 'Notification deleted');
    } catch (error) {
      next(error);
    }
  }

  return { getNotifications, markRead, markAllRead, deleteNotification };
}

module.exports = createNotificationController;
