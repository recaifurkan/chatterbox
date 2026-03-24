const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    action: {
      type: String,
      enum: ['edit', 'delete', 'restore'],
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    before: {
      content: String,
      attachments: mongoose.Schema.Types.Mixed,
    },
    after: {
      content: String,
      attachments: mongoose.Schema.Types.Mixed,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ messageId: 1 });
auditLogSchema.index({ roomId: 1 });
auditLogSchema.index({ actorId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

