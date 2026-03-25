/**
 * Dependency Injection Container
 *
 * Tüm servisler burada oluşturulur ve bağımlılıkları enjekte edilir.
 * Controller ve route dosyaları servisleri buradan alır.
 */

// ── Models ────────────────────────────────────────────────────────────────────
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const AuditLog = require('./models/AuditLog');
const Notification = require('./models/Notification');

// ── Infrastructure (lazy getters) ────────────────────────────────────────────
const { getRedisClient } = require('./config/redis');
const { getIO } = require('./config/socket');
const { uploadBuffer, deleteObject, extractObjectName, minioClient, BUCKET } = require('./config/minio');

// ── Service Classes ──────────────────────────────────────────────────────────
const AuditService = require('./services/audit.service');
const AuthService = require('./services/auth.service');
const MessageService = require('./services/message.service');
const NotificationService = require('./services/notification.service');
const PresenceService = require('./services/presence.service');
const RoomService = require('./services/room.service');
const SchedulerService = require('./services/scheduler.service');
const UploadService = require('./services/upload.service');
const UserService = require('./services/user.service');

// ── Service Instances ─────────────────────────────────────────────────────────

const auditService = new AuditService({ AuditLog });

const authService = new AuthService({ User, getRedisClient });

const presenceService = new PresenceService({ getRedisClient });

const notificationService = new NotificationService({ Notification, getIO });

const messageService = new MessageService({ Message, Room, auditService });

const roomService = new RoomService({ Room, User, Message });

const uploadService = new UploadService({ uploadBuffer, minioClient, BUCKET });

const userService = new UserService({
  User,
  presenceService,
  getIO,
  uploadBuffer,
  deleteObject,
  extractObjectName,
});

const schedulerService = new SchedulerService({ Message, Room, getRedisClient, getIO });

// ── Export ─────────────────────────────────────────────────────────────────────

module.exports = {
  auditService,
  authService,
  messageService,
  notificationService,
  presenceService,
  roomService,
  schedulerService,
  uploadService,
  userService,
};

