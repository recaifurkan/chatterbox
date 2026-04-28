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

// ── Service Classes ──────────────────────────────────────────────────────────
const AuditService = require('./services/audit.service');
const AuthService = require('./services/auth.service');
const MessageService = require('./services/message.service');
const NotificationService = require('./services/notification.service');
const PresenceService = require('./services/presence.service');
const RedisService = require('./services/redis.service');
const RoomService = require('./services/room.service');
const SchedulerService = require('./services/scheduler.service');
const UploadService = require('./services/upload.service');
const UserService = require('./services/user.service');
const LiveKitService = require('./services/livekit.service');
const MediaService = require('./services/media.service');

// ── Storage (Filesystem) ─────────────────────────────────────────────────────
// S3'e geçmek için: config/storage.js içindeki provider'ı değiştirin.
// FilesystemService ve diğer servisler değişmez.
const { storageProvider } = require('./config/storage');
const FilesystemService = require('./services/filesystem.service');

// ── Middleware Factories ──────────────────────────────────────────────────────
const createAuthMiddleware = require('./middlewares/auth.middleware');
const createSocketAuthMiddleware = require('./middlewares/socketAuth.middleware');

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

// Redis Service — tek bir redisService örneği tüm bağımlılıklara enjekte edilir
const redisService = new RedisService({ getRedisClient });

const authService = new AuthService({ User, redisService });

const presenceService = new PresenceService({ redisService });

const notificationService = new NotificationService({ Notification, getIO });

const messageService = new MessageService({ Message, Room, auditService });

const roomService = new RoomService({ Room, User, Message });

const mediaService = new MediaService();

// ── Storage provider seçimi ───────────────────────────────────────────────────
// Konfigürasyon config/storage.js içinde yönetilir.
const filesystemService = new FilesystemService({ storageProvider });

const uploadService = new UploadService({ filesystemService, mediaService });

const userService = new UserService({
  User,
  presenceService,
  getIO,
  filesystemService,
  mediaService,
});

const schedulerService = new SchedulerService({ Message, Room, redisService, getIO });

const livekitService = new LiveKitService();

// ── Middleware Instances ───────────────────────────────────────────────────────
const { authenticate, authorize } = createAuthMiddleware({ redisService });
const socketAuthMiddleware = createSocketAuthMiddleware({ redisService });

// ── Handler Instances ─────────────────────────────────────────────────────────

const chatHandler = new ChatHandler({ notificationService, messageService });
const dmHandler = new DMHandler({ notificationService });
const presenceHandler = new PresenceHandler({ presenceService, redisService });
const reactionHandler = new ReactionHandler({ messageService });
const readReceiptHandler = new ReadReceiptHandler({ messageService });
const typingHandler = new TypingHandler({ presenceService });
const callHandler = new CallHandler({ redisService, livekitService });

// ── Export ─────────────────────────────────────────────────────────────────────

module.exports = {
  // Services
  auditService,
  authService,
  filesystemService,
  messageService,
  notificationService,
  presenceService,
  redisService,
  roomService,
  schedulerService,
  uploadService,
  userService,
  // Middlewares
  authenticate,
  authorize,
  socketAuthMiddleware,
  // Handlers
  chatHandler,
  dmHandler,
  presenceHandler,
  reactionHandler,
  readReceiptHandler,
  typingHandler,
  callHandler,
};

