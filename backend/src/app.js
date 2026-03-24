const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const messageRoutes = require('./routes/message.routes');
const uploadRoutes = require('./routes/upload.routes');
const searchRoutes = require('./routes/search.routes');
const notificationRoutes = require('./routes/notification.routes');
const scheduledRoutes = require('./routes/scheduled.routes');
const { serveFile } = require('./controllers/upload.controller');
const { errorHandler } = require('./middlewares/errorHandler.middleware');
const { generalLimiter } = require('./middlewares/rateLimiter.middleware');
const logger = require('./utils/logger');

const app = express();

// Nginx arkasında gerçek istemci IP'sini kullan.
// Bu olmadan rate limiter tüm kullanıcıları nginx'in IP'si üzerinden sayar
// ve tek bir kullanıcı gibi görünür → herkes çok çabuk 429 alır.
app.set('trust proxy', 1);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
// İzin verilen origin'ler:
//  1. CLIENT_URL env değişkeni (tek veya virgülle ayrılmış liste)
//  2. CORS_ORIGINS env değişkeni — ekstra origin listesi (virgülle ayrılmış)
//  3. localhost / 127.x.x.x (her port)
//  4. RFC-1918 özel ağ adresleri: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
//     → aynı Wi-Fi / LAN üzerindeki cihazlardan erişime olanak tanır
//  5. development modunda her şeye izin verilir
const _buildOriginSet = () => {
  const raw = [
    ...(process.env.CLIENT_URL   || 'http://localhost:3000').split(','),
    ...(process.env.CORS_ORIGINS || '').split(','),
  ];
  return new Set(raw.map((s) => s.trim()).filter(Boolean));
};

const _allowedOrigins = _buildOriginSet();

// Özel ağ aralıkları (RFC 1918 + loopback)
const _privateRanges = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

function _isAllowedOrigin(origin) {
  if (!origin) return true;                            // Postman / server-to-server
  if (process.env.NODE_ENV === 'development') return true;
  if (_allowedOrigins.has(origin)) return true;
  return _privateRanges.some((re) => re.test(origin));
}

app.use(cors({
  origin: (origin, callback) => {
    if (_isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS: origin reddedildi → ${origin}`);
      callback(new Error(`CORS policy: origin not allowed — ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging — instance ID ile hangi node'un cevap verdiğini gösterir
app.use((req, res, next) => {
  res.setHeader('X-Instance-ID', process.env.INSTANCE_ID || 'default');
  next();
});
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.url === '/health',
}));

// Rate limiting
app.use('/api/', generalLimiter);

// NOT: Dosyalar artık MinIO üzerinde. /uploads static endpoint kaldırıldı.
// Dosya URL'leri MINIO_PUBLIC_URL + /BUCKET/object-path formatında döner.

// Dosya servisi — MinIO'ya doğrudan erişim yerine backend proxy
// Auth gerekmez; UUID tabanlı URL'ler tahmin edilemez
app.get('/api/v1/files/*', serveFile);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/scheduled', scheduledRoutes);

// Health check — instance ID dahil
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    instance: process.env.INSTANCE_ID || 'default',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

module.exports = app;

