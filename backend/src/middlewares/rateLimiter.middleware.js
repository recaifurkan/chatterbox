const rateLimit = require('express-rate-limit');

// Genel API — 15 dk pencerede 1000 istek (eskisi: 100)
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla istek. Lütfen bekleyin.' },
});

// Auth — 15 dk pencerede 50 deneme (eskisi: 10, brute-force koruması yeterli)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika bekleyin.' },
  skipSuccessfulRequests: true, // başarılı girişler sayılmaz
});

// Upload — 1 dk'da 30 dosya (eskisi: 10)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla dosya yükleme isteği.' },
});

// Mesaj — 1 dk'da 300 mesaj (eskisi: 60)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Mesaj gönderme limiti aşıldı.' },
});

module.exports = { generalLimiter, authLimiter, uploadLimiter, messageLimiter };
