const Message = require('../models/Message');
const Room = require('../models/Room');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function createScheduledMessage(req, res, next) {
  try {
    const { roomId, content, attachments = [], scheduledAt } = req.body;

    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      return errorResponse(res, 'scheduledAt must be in the future', 400);
    }

    if (!content && attachments.length === 0) {
      return errorResponse(res, 'Message must have content or at least one attachment', 400);
    }

    const room = await Room.findById(roomId);
    if (!room || !room.isMember(req.user._id)) {
      return errorResponse(res, 'Room not found or not a member', 404);
    }

    const message = await Message.create({
      roomId,
      senderId: req.user._id,
      content,
      attachments,
      isScheduled: true,
      scheduledAt: new Date(scheduledAt),
    });

    return successResponse(res, { message }, 'Message scheduled', 201);
  } catch (error) {
    next(error);
  }
}

async function listScheduledMessages(req, res, next) {
  try {
    const messages = await Message.find({
      senderId: req.user._id,
      isScheduled: true,
      isDeleted: false,
    }).populate('roomId', 'name').sort({ scheduledAt: 1 });

    return successResponse(res, { messages });
  } catch (error) {
    next(error);
  }
}

async function cancelScheduledMessage(req, res, next) {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      senderId: req.user._id,
      isScheduled: true,
    });

    if (!message) return errorResponse(res, 'Scheduled message not found', 404);

    message.isDeleted = true;
    message.isScheduled = false;
    await message.save();

    return successResponse(res, null, 'Scheduled message cancelled');
  } catch (error) {
    next(error);
  }
}

module.exports = { createScheduledMessage, listScheduledMessages, cancelScheduledMessage };

