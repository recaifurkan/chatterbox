const { successResponse } = require('../utils/apiResponse');

/**
 * @param {import('../services/scheduler.service')} schedulerService
 */
function createScheduledController(schedulerService) {
  async function createScheduledMessage(req, res, next) {
    try {
      const data = await schedulerService.createScheduledMessage(req.user._id, req.body);
      return successResponse(res, data, 'Message scheduled', 201);
    } catch (error) {
      next(error);
    }
  }

  async function listScheduledMessages(req, res, next) {
    try {
      const data = await schedulerService.listScheduledMessages(req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function cancelScheduledMessage(req, res, next) {
    try {
      await schedulerService.cancelScheduledMessage(req.params.id, req.user._id);
      return successResponse(res, null, 'Scheduled message cancelled');
    } catch (error) {
      next(error);
    }
  }

  return { createScheduledMessage, listScheduledMessages, cancelScheduledMessage };
}

module.exports = createScheduledController;

