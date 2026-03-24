const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisPubSub } = require('./redis');
const { socketAuthMiddleware } = require('../middlewares/socketAuth.middleware');
const { registerChatHandlers } = require('../socket/handlers/chat.handler');
const { registerTypingHandlers } = require('../socket/handlers/typing.handler');
const { registerPresenceHandlers } = require('../socket/handlers/presence.handler');
const { registerReactionHandlers } = require('../socket/handlers/reaction.handler');
const { registerReadReceiptHandlers } = require('../socket/handlers/readReceipt.handler');
const { registerDMHandlers } = require('../socket/handlers/dm.handler');
const logger = require('../utils/logger');

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },

    // ─── Sticky session gerektirmeden multi-node çalışmanın anahtarı ────────
    //
    // Socket.IO'nun varsayılan modu: önce HTTP long-polling, sonra WebSocket'e
    // upgrade (EIO handshake). Bu polling fazında ardışık HTTP istekleri farklı
    // sunuculara düşerse session tutarsızlığı oluşur → ip_hash gibi sticky session
    // mekanizması gerekir.
    //
    // transports: ['websocket'] ile polling fazı tamamen atlanır:
    //   1. Client tek bir HTTP Upgrade isteği gönderir.
    //   2. Bağlantı WebSocket'e yükseltilir (tek TCP soket, kalıcı).
    //   3. Artık "farklı sunucuya düşme" riski yoktur — sticky session gereksiz.
    //
    // Cross-server mesaj dağıtımı Redis Adapter üstlenir:
    //   • Pub/Sub kanalı: socket.io#<room>#   (oda eventleri)
    //   • socket.io#<namespace>#  (broadcast eventleri)
    //   Backend-1'deki client'a gönderilmek istenen bir event, Backend-2 tarafından
    //   Redis'e publish edilir; Backend-1 subscribe olduğu için alır ve iletir.
    //
    transports: ['websocket'],

    pingTimeout: 60000,
    pingInterval: 25000,

    // Bağlantı kopunca client otomatik yeniden bağlanır; sunucu tarafında
    // odalar presence.handler'da her connect'te yeniden join edilir.
    connectTimeout: 45000,
  });

  // ── Redis Adapter: tüm node'lar arası Pub/Sub köprüsü ──────────────────
  const { pubClient, subClient } = getRedisPubSub();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info(`✅ Socket.IO Redis Adapter bağlandı [${process.env.INSTANCE_ID || 'default'}]`);

  // ── JWT doğrulama middleware ────────────────────────────────────────────
  io.use(socketAuthMiddleware);

  // ── Bağlantı eventleri ──────────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`Socket bağlandı: ${socket.id} | User: ${socket.user.username} | Instance: ${process.env.INSTANCE_ID || 'default'}`);

    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerDMHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerReadReceiptHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket ayrıldı: ${socket.id} | ${socket.user?.username} | Sebep: ${reason}`);
    });
  });

  logger.info(`✅ Socket.IO başlatıldı (transport: websocket-only, Redis Adapter aktif)`);
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO henüz başlatılmadı');
  return io;
}

module.exports = { initializeSocket, getIO };

