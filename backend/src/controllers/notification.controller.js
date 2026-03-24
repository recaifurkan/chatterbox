const Notification = require('../models/Notification');
const { successResponse } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/AppError');

async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const query = { userId: req.user._id };
    if (unread === 'true') query.read = false;

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .populate('sender', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    return successResponse(res, { notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new NotFoundError('Notification not found');
    return successResponse(res, null, 'Marked as read');
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    return successResponse(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
}

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
