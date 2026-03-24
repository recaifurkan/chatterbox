const mongoose = require('mongoose');
const { MESSAGE_TYPES } = require('../utils/constants');

const attachmentSchema = new mongoose.Schema(
  {
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    url: String,
    thumbnailUrl: String,
    width: Number,
    height: Number,
    duration: Number,
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const editHistorySchema = new mongoose.Schema(
  {
    content: String,
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const readBySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      default: MESSAGE_TYPES.TEXT,
    },
    content: {
      type: String,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    readBy: [readBySchema],
    editHistory: [editHistorySchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ 'mentions': 1 });
messageSchema.index({ scheduledAt: 1, isScheduled: 1 });

// TTL index for expiring (self-destructing) messages
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Message', messageSchema);

