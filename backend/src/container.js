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
const LiveKitService = require('./services/livekit.service');

// ── Handler Classes ──────────────────────────────────────────────────────────
const ChatHandler = require('./socket/handlers/chat.handler');
const DMHandler = require('./socket/handlers/dm.handler');
const PresenceHandler = require('./socket/handlers/presence.handler');
const ReactionHandler = require('./socket/handlers/reaction.handler');
const ReadReceiptHandler = require('./socket/handlers/readReceipt.handler');
const TypingHandler = require('./socket/handlers/typing.handler');
const CallHandler = require('./socket/handlers/call.handler');

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

const livekitService = new LiveKitService();

// ── Handler Instances ─────────────────────────────────────────────────────────

const chatHandler = new ChatHandler({ notificationService, messageService });
const dmHandler = new DMHandler({ notificationService });
const presenceHandler = new PresenceHandler({ presenceService, getRedisClient });
const reactionHandler = new ReactionHandler({ messageService });
const readReceiptHandler = new ReadReceiptHandler({ messageService });
const typingHandler = new TypingHandler({ presenceService });
const callHandler = new CallHandler({ getRedisClient, livekitService });

// ── Export ─────────────────────────────────────────────────────────────────────

module.exports = {
  // Services
  auditService,
  authService,
  messageService,
  notificationService,
  presenceService,
  roomService,
  schedulerService,
  uploadService,
  userService,
  // Handlers
  chatHandler,
  dmHandler,
  presenceHandler,
  reactionHandler,
  readReceiptHandler,
  typingHandler,
  callHandler,
};

