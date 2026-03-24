# Chatterbox

A production-ready, full-stack real-time chat application built with Node.js, Socket.IO, Redis, React, and Tailwind CSS. Supports horizontal scaling via Redis Adapter for multi-server Socket.IO clusters.

---

## Architecture

```
                          ┌─────────────────────────────┐
                          │           Nginx              │
                          │  Reverse Proxy + WS Upgrade  │
                          └────────────┬────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                         │
               ┌──────────▼──────────┐   ┌──────────▼──────────┐
               │      Frontend       │   │      Backend(s)      │
               │   React + Vite      │   │   Node.js + Express  │
               │   Tailwind + Zustand│   │   Socket.IO          │
               └─────────────────────┘   └──────────┬──────────┘
                                                     │
                                    ┌────────────────┼───────────────┐
                                    │                │               │
                             ┌──────▼─────┐   ┌──────▼─────┐  ┌────▼─────┐
                             │  MongoDB   │   │   Redis    │  │  MinIO   │
                             │   data     │   │  adapter   │  │  files   │
                             └────────────┘   │  sessions  │  └──────────┘
                                              └────────────┘
```

Redis Adapter enables running multiple backend instances simultaneously. All Socket.IO events are synchronized across nodes via Redis Pub/Sub.

---

## Features

### Authentication
- Register and login with email or username
- JWT access tokens (15 min) with refresh tokens (7 days, stored in Redis)
- Token blacklisting on logout
- Socket.IO connections authenticated via JWT

### Rooms
- Public and private (invite-code) rooms
- Direct message (DM) rooms
- Room creation, update, and deletion
- Member roles: owner, admin, moderator, member

### Messaging
- Real-time text messages
- File attachments: images, videos, PDF, ZIP, TXT (max 25 MB)
- Emoji picker
- Reply-to (quoted messages)
- @mention notifications
- Message editing with audit log
- Soft-delete with moderator support
- Read receipts
- Cursor-based pagination (infinite scroll)
- Self-destructing messages (TTL via MongoDB index)
- Scheduled message delivery (cron + Redis distributed lock)

### Real-time
- Instant delivery via Socket.IO WebSocket
- Typing indicators with auto-clear
- Online / offline / busy / idle presence broadcast
- User joined / left room notifications

### Notifications
- Real-time in-app notifications (Socket.IO)
- Mention and DM notifications
- Browser Notification API support
- Unread counter with mark-all-read

### Search
- Full-text message search (MongoDB text index)
- Filters: room, user, date range

### Security
- Rate limiting on auth, API, upload, and message routes
- Helmet.js HTTP security headers
- CORS restriction
- File MIME-type whitelist and size limits
- Socket authentication on every connection
- Audit log for all edit and delete actions
- MinIO bucket is private; files served exclusively through the backend

---

## Project Structure

```
chatterbox/
├── .env.example              ← Docker Compose secrets template (copy → .env)
├── docker-compose.yml
├── start.sh / stop.sh
├── docker/
│   ├── nginx.conf
│   └── mongo-init.js
├── backend/
│   ├── .env.example          ← Local dev template (copy → backend/.env)
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── models/
│       ├── controllers/
│       ├── routes/
│       ├── middlewares/
│       ├── services/
│       ├── socket/handlers/
│       └── utils/
└── frontend/
    ├── .env.example          ← Frontend template (copy → frontend/.env)
    └── src/
        ├── App.jsx
        ├── pages/
        ├── components/
        ├── store/
        ├── api/
        └── utils/
```

---

## Getting Started

### Requirements

- Docker and Docker Compose

### Quick Start

```bash
git clone https://github.com/your-username/chatterbox.git
cd chatterbox

# 1. Create your .env from the template and set strong secrets
cp .env.example .env
#    Edit .env — change all "change_me_*" values!
#    Minimum: MONGO_ROOT_PASSWORD, REDIS_PASSWORD, MINIO_SECRET_KEY,
#             JWT_SECRET, JWT_REFRESH_SECRET

# 2. Start everything
./start.sh
# or: docker compose up --build -d
```

The application will be available at `http://localhost` (or the `APP_PORT` you configured).

```bash
# View logs
docker compose logs -f backend

# Stop
./stop.sh

# Stop and remove all data volumes
docker compose down -v
```

### Local Development (without Docker for backend/frontend)

Start only the infrastructure services:

```bash
docker compose up -d mongodb redis minio
```

Backend:

```bash
cd backend
cp .env.example .env   # edit values
npm install
npm run dev            # http://localhost:5000
```

Frontend:

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:5000/api/v1
#                        set VITE_SOCKET_URL=http://localhost:5000
npm install
npm run dev            # http://localhost:3000
```

---

## Environment Variables

### Root `.env` — Docker Compose Secrets

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_ROOT_USERNAME` | MongoDB root user | ✅ |
| `MONGO_ROOT_PASSWORD` | MongoDB root password | ✅ |
| `MONGO_DB` | Database name | ✅ |
| `REDIS_PASSWORD` | Redis password | ✅ |
| `JWT_SECRET` | JWT signing secret ≥ 32 chars — `openssl rand -hex 32` | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret ≥ 32 chars | ✅ |
| `MINIO_ACCESS_KEY` | MinIO / S3 access key | ✅ |
| `MINIO_SECRET_KEY` | MinIO / S3 secret key | ✅ |
| `MINIO_BUCKET` | Storage bucket name | default: `chatterbox-uploads` |
| `CLIENT_URL` | Allowed CORS origin | default: `http://localhost` |
| `APP_PORT` | Host port for the app | default: `80` |
| `JWT_EXPIRES_IN` | Access token TTL | default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | default: `7d` |

### `backend/.env` — Local Development

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Full MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Same as above |
| `JWT_REFRESH_SECRET` | Same as above |
| `CLIENT_URL` | Allowed CORS origin |
| `MINIO_ENDPOINT` | MinIO host (`localhost` for local, `minio` in Docker) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO credentials |
| `MINIO_BUCKET` | Bucket name |

### `frontend/.env` — Vite

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (`/api/v1` in Docker, full URL in local dev) |
| `VITE_SOCKET_URL` | Socket.IO URL (empty = same origin) |

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout (blacklists token) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user |

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/v1/rooms` | List public rooms |
| GET    | `/api/v1/rooms/my` | Rooms I belong to |
| POST   | `/api/v1/rooms` | Create room |
| GET    | `/api/v1/rooms/:id` | Room detail |
| PUT    | `/api/v1/rooms/:id` | Update room |
| DELETE | `/api/v1/rooms/:id` | Delete room |
| POST   | `/api/v1/rooms/dm` | Open or create a DM room |
| POST   | `/api/v1/rooms/:id/join` | Join room |
| POST   | `/api/v1/rooms/:id/leave` | Leave room |
| GET    | `/api/v1/rooms/:id/members` | List members |
| POST   | `/api/v1/rooms/:id/members` | Add member |
| PATCH  | `/api/v1/rooms/:id/members/role` | Update member role |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/v1/messages/room/:roomId` | Get messages (paginated) |
| PUT    | `/api/v1/messages/:id` | Edit message |
| DELETE | `/api/v1/messages/:id` | Delete message |
| POST   | `/api/v1/messages/room/:roomId/read` | Mark as read |
| POST   | `/api/v1/messages/:id/reactions` | Add reaction |
| DELETE | `/api/v1/messages/:id/reactions/:emoji` | Remove reaction |
| GET    | `/api/v1/messages/:id/audit` | Audit log for a message |

### Upload and Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Upload files (multipart, max 25 MB, up to 5 files) |
| GET  | `/api/v1/files/:objectName` | Serve a file (streamed through backend) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/v1/users/:id` | Get user profile |
| PUT    | `/api/v1/users/me` | Update profile |
| POST   | `/api/v1/users/me/avatar` | Upload avatar |
| PATCH  | `/api/v1/users/me/status` | Set status |
| GET    | `/api/v1/users/search` | Search users |
| POST   | `/api/v1/users/:id/block` | Block user |
| DELETE | `/api/v1/users/:id/block` | Unblock user |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/search/messages` | Full-text message search |

### Scheduled Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/v1/scheduled` | List scheduled messages |
| POST   | `/api/v1/scheduled` | Schedule a message |
| DELETE | `/api/v1/scheduled/:id` | Cancel scheduled message |

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId }` | Join a room |
| `leave_room` | `{ roomId }` | Leave a room |
| `send_message` | `{ roomId, content, attachments?, replyTo?, expiresIn? }` | Send message |
| `edit_message` | `{ messageId, content }` | Edit message |
| `delete_message` | `{ messageId }` | Delete message |
| `send_dm` | `{ targetUserId, content, attachments? }` | Send direct message |
| `typing_start` | `{ roomId }` | Start typing indicator |
| `typing_stop` | `{ roomId }` | Stop typing indicator |
| `set_status` | `{ status }` | Update presence status |
| `add_reaction` | `{ messageId, emoji }` | Add reaction |
| `remove_reaction` | `{ messageId, emoji }` | Remove reaction |
| `mark_read` | `{ roomId, messageIds[] }` | Mark messages as read |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `{ message }` | New message in room |
| `message_edited` | `{ messageId, content, isEdited }` | Message was edited |
| `message_deleted` | `{ messageId }` | Message was deleted |
| `new_dm` | `{ room, message }` | New direct message |
| `user_typing` | `{ userId, username, roomId }` | User is typing |
| `user_stop_typing` | `{ userId, roomId }` | User stopped typing |
| `user_status_change` | `{ userId, status, isOnline, lastSeen }` | Presence update |
| `reaction_updated` | `{ messageId, reactions[] }` | Reactions changed |
| `messages_read` | `{ messageIds[], readBy }` | Read receipt |
| `new_notification` | `{ notification }` | In-app notification |
| `room_joined` | `{ roomId }` | Confirmed room join |
| `user_joined_room` | `{ roomId, user }` | Another user joined |
| `user_left_room` | `{ roomId, userId }` | Another user left |

---

## Horizontal Scaling

`docker-compose.yml` includes two backend nodes (`backend`, `backend2`) by default. Nginx distributes connections using `least_conn`.

Since all transports are forced to WebSocket (`transports: ['websocket']`), sticky sessions are not required. Once a WebSocket connection is established it stays on the same node for its lifetime. Cross-node messaging is handled transparently by the Redis Adapter.

The scheduled message runner uses a Redis `SET NX EX` distributed lock to guarantee only one node executes the cron job at a time.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Real-time | Socket.IO 4.x |
| Backend | Node.js 20, Express 4 |
| Database | MongoDB 7 (Mongoose) |
| Cache / Broker | Redis 7 (ioredis, @socket.io/redis-adapter) |
| File Storage | MinIO (S3-compatible, private bucket) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Upload | Multer |
| Logging | Winston + daily-rotate-file |
| Scheduler | node-cron + Redis distributed lock |
| Proxy | Nginx Alpine |
| Containers | Docker, Docker Compose |

