const { successResponse, paginationMeta } = require('../utils/apiResponse');

/**
 * Factory function — MessageService enjekte edilerek ince bir HTTP katmanı oluşturur.
 * İş mantığı tamamen MessageService içindedir.
 *
 * @param {import('../services/message.service')} messageService
 */
function createMessageController(messageService) {
  async function getMessages(req, res, next) {
    try {
      const { roomId } = req.params;
      const { page = 1, limit = 50, before } = req.query;

      const { messages, total } = await messageService.getMessages(roomId, { page, limit, before });

      return successResponse(
        res,
        { messages },
        'Messages fetched',
        200,
        paginationMeta(total, page, limit)
      );
    } catch (error) {
      next(error);
    }
  }

  async function editMessage(req, res, next) {
    try {
      const { message } = await messageService.editMessage(
        req.params.id,
        req.user._id,
        req.body.content,
        req.ip
      );
      return successResponse(res, { message }, 'Message edited');
    } catch (error) {
      next(error);
    }
  }

  async function deleteMessage(req, res, next) {
    try {
      const data = await messageService.deleteMessage(req.params.id, req.user._id, req.ip);
      return successResponse(res, data, 'Message deleted');
    } catch (error) {
      next(error);
    }
  }

  async function markRead(req, res, next) {
    try {
      const { roomId } = req.params;
      const { messageIds } = req.body;

      await messageService.markRead(roomId, messageIds, req.user._id);
      return successResponse(res, null, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  async function addReaction(req, res, next) {
    try {
      const data = await messageService.addReaction(req.params.id, req.user._id, req.body.emoji);
      return successResponse(res, data, 'Reaction added');
    } catch (error) {
      next(error);
    }
  }

  async function removeReaction(req, res, next) {
    try {
      const decodedEmoji = decodeURIComponent(req.params.emoji);
      const data = await messageService.removeReaction(req.params.id, req.user._id, decodedEmoji);
      return successResponse(res, data, 'Reaction removed');
    } catch (error) {
      next(error);
    }
  }

  async function getAuditLog(req, res, next) {
    try {
      const data = await messageService.getAuditLog(req.params.messageId, req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function searchMessages(req, res, next) {
    try {
      const { q, roomId, userId, startDate, endDate, page = 1, limit = 20 } = req.query;

      const { messages, total } = await messageService.searchMessages({
        q, roomId, userId, startDate, endDate, page, limit,
      });

      return successResponse(res, { messages }, 'Search results', 200, paginationMeta(total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  return {
    getMessages,
    editMessage,
    deleteMessage,
    markRead,
    addReaction,
    removeReaction,
    getAuditLog,
    searchMessages,
  };
}

module.exports = createMessageController;
