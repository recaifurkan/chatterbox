/**
 * Chatterbox — MongoDB Initialization Script
 *
 * This script runs once when the MongoDB container is first created.
 * It creates the collections and indexes required by the application.
 *
 * The root user credentials are set via MONGO_INITDB_ROOT_USERNAME /
 * MONGO_INITDB_ROOT_PASSWORD in docker-compose.yml (read from .env).
 * The application connects using those same root credentials.
 */

// Use the DB name passed via MONGO_INITDB_DATABASE (defaults to chatterboxdb)
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'chatterboxdb');

// ── Collections ──────────────────────────────────────────────────────────────
db.createCollection('users');
db.createCollection('rooms');
db.createCollection('messages');
db.createCollection('auditlogs');
db.createCollection('notifications');

// ── Indexes ───────────────────────────────────────────────────────────────────
db.messages.createIndex({ roomId: 1, createdAt: -1 });
db.messages.createIndex({ content: 'text' });
db.messages.createIndex({ senderId: 1 });
db.messages.createIndex({ isScheduled: 1, scheduledAt: 1 });

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

db.rooms.createIndex({ name: 1 });
db.rooms.createIndex({ type: 1 });
db.rooms.createIndex({ 'members.user': 1 });

db.notifications.createIndex({ userId: 1, read: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

print('✅ Chatterbox: MongoDB initialized successfully');
