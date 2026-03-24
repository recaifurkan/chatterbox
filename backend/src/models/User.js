const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_STATUS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.OFFLINE,
    },
    statusMessage: {
      type: String,
      maxlength: [100, 'Status message cannot exceed 100 characters'],
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    mutedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    rooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
      },
    ],
    notificationPreferences: {
      mentions: { type: Boolean, default: true },
      directMessages: { type: Boolean, default: true },
      roomMessages: { type: Boolean, default: false },
      browserPush: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields
userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    status: this.status,
    statusMessage: this.statusMessage,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);

