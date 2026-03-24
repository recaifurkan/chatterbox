const mongoose = require('mongoose');
const { ROOM_TYPES, ROOM_ROLES } = require('../utils/constants');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(ROOM_ROLES),
      default: ROOM_ROLES.MEMBER,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [50, 'Room name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    type: {
      type: String,
      enum: Object.values(ROOM_TYPES),
      default: ROOM_TYPES.PUBLIC,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [memberSchema],
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

roomSchema.index({ name: 'text', description: 'text' });
roomSchema.index({ type: 1 });
roomSchema.index({ createdBy: 1 });

// Virtual: member count
roomSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

// Check if user is member
roomSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.user.toString() === userId.toString());
};

// Check if user has role
roomSchema.methods.hasRole = function (userId, roles) {
  const member = this.members.find((m) => m.user.toString() === userId.toString());
  if (!member) return false;
  return Array.isArray(roles) ? roles.includes(member.role) : member.role === roles;
};

module.exports = mongoose.model('Room', roomSchema);

