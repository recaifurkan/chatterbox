class AuditService {
  constructor({ AuditLog }) {
    this.AuditLog = AuditLog;
  }

  /**
   * Audit log kaydı oluşturur.
   */
  async logAction({ messageId, roomId, action, actorId, before, after, ipAddress }) {
    return this.AuditLog.create({
      messageId,
      roomId,
      action,
      actorId,
      before,
      after,
      ipAddress,
    });
  }

  /**
   * Belirli bir mesaja ait audit loglarını döner.
   */
  async getLogsForMessage(messageId) {
    return this.AuditLog.find({ messageId })
      .populate('actorId', 'username')
      .sort({ createdAt: -1 });
  }
}

module.exports = AuditService;

