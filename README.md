# Chatterbox

A full-stack real-time chat application built with Node.js, Socket.IO, Redis, React, and Tailwind CSS. Supports horizontal scaling via Redis Adapter for multi-server Socket.IO clusters.

---

## Architecture

```
                          ┌─────────────────────────────┐
                          │        Ngrok Tunnel          │
                          │  Public HTTPS → localhost    │
                          └────────────┬────────────────┘
                                       │
                          ┌────────────▼────────────────┐
                          │           Nginx              │
                          │  Reverse Proxy + WS Upgrade  │
                          └────────────┬────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                         │
               ┌──────────▼──────────┐   ┌──────────▼──────────┐
               │   Frontend (×2)     │   │    Backend (×2)      │
               │   React + Vite      │   │   Node.js + Express  │
               │   Tailwind + Zustand│   │   Socket.IO          │
               └──────────┬──────────┘   └──────────┬──────────┘
                          │                          │
                          │              ┌───────────┼───────────────┐
                          │              │           │               │
                          │       ┌──────▼─────┐ ┌──▼────────┐ ┌───▼──────┐
                          │       │  MongoDB   │ │   Redis   │ │  MinIO   │
                          │       │   data     │ │  adapter  │ │  files   │
                          │       └────────────┘ │  sessions │ └──────────┘
                          │                      └───────────┘
                          │
                 ┌────────▼──────────┐
                 │   LiveKit Server  │
                 │   WebRTC SFU      │
                 │   (voice/video)   │
                 └───────────────────┘
```

Redis Adapter enables running multiple backend instances simultaneously. All Socket.IO events are synchronized across nodes via Redis Pub/Sub.

Ngrok provides a public HTTPS tunnel for external access (mobile testing, demos, webhooks, etc.).

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
- **WebRTC voice and video calls via LiveKit SFU (1:1 in DM rooms)**
- **Call controls: mute, camera toggle, screen sharing**
- **LiveKit handles all WebRTC complexity (SDP, ICE, TURN/STUN)**

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
- CORS restriction (auto-allow localhost + RFC-1918 private IPs)
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
│       ├── container.js      ← DI container
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
    ├── vite.config.js        ← Vite proxy for local dev
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
git clone https://github.com/recaifurkan/chatterbox.git
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
cp .env.example .env   # defaults work with Vite proxy
npm install
npm run dev            # http://localhost:3000
```

> **Note:** In local dev mode, Vite automatically proxies `/api` and `/socket.io` requests to the backend (`VITE_BACKEND_URL`, default `http://localhost:5000`). No CORS issues, no need to set full URLs. Other devices on the same LAN can access the app via `http://<your-ip>:3000`.

---

## Ngrok — Public HTTPS Tunnel

The `docker-compose.yml` includes a built-in **ngrok** service that creates a public HTTPS tunnel pointing to the Nginx container. This is useful for:

- Testing the app from a mobile device outside your local network
- Sharing a live demo link with others
- Receiving webhooks from external services
- Testing HTTPS-only browser features (e.g., Notification API, clipboard)

### Setup

1. Sign up at [https://ngrok.com](https://ngrok.com) and get your **Authtoken** from the [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken).

2. Add the token to your `.env` file:

   ```dotenv
   NGROK_AUTHTOKEN=your_ngrok_authtoken_here
   ```

3. Start the stack as usual:

   ```bash
   ./start.sh
   ```

4. Find your public URL:

   - **Ngrok web inspector:** open [http://localhost:4040](http://localhost:4040) in your browser
   - **Or via API:**
     ```bash
     curl -s http://localhost:4040/api/tunnels | python3 -c \
       "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])"
     ```

5. *(Optional)* Add the ngrok URL to `CORS_ORIGINS` or `CLIENT_URL` in `.env` if running in production mode:

   ```dotenv
   CLIENT_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
   ```

   > In **development** mode (`NODE_ENV=development`) all origins are allowed automatically, so this step is not needed for local testing.

### Ngrok Web Inspector

The ngrok web inspector at `http://localhost:4040` lets you:
- See the public HTTPS URL
- Inspect all HTTP/WebSocket traffic in real time
- Replay requests for debugging

---

## Environment Variables

### Root `.env` — Docker Compose Secrets

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_ROOT_USERNAME` | MongoDB root user | ✅ |
| `MONGO_ROOT_PASSWORD` | MongoDB root password | ✅ |
| `MONGO_DB` | Database name | default: `chatterboxdb` |
| `MONGO_PORT` | Host port for MongoDB | default: `27017` |
| `REDIS_PASSWORD` | Redis password | ✅ |
| `REDIS_PORT` | Host port for Redis | default: `6379` |
| `JWT_SECRET` | JWT signing secret ≥ 32 chars — `openssl rand -hex 32` | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret ≥ 32 chars | ✅ |
| `JWT_EXPIRES_IN` | Access token TTL | default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | default: `7d` |
| `MINIO_ACCESS_KEY` | MinIO / S3 access key | ✅ |
| `MINIO_SECRET_KEY` | MinIO / S3 secret key | ✅ |
| `MINIO_BUCKET` | Storage bucket name | default: `chatterbox-uploads` |
| `MINIO_API_PORT` | Host port for MinIO S3 API | default: `9000` |
| `MINIO_CONSOLE_PORT` | Host port for MinIO web console | default: `9001` |
| `CLIENT_URL` | Allowed CORS origin | default: `http://localhost` |
| `CORS_ORIGINS` | Extra allowed CORS origins (comma-separated) | optional |
| `APP_PORT` | Host port for the app (Nginx) | default: `80` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | default: `900000` |
| `RATE_LIMIT_MAX` | Max requests per window per IP | default: `1000` |
| `MAX_FILE_SIZE` | Max upload file size (bytes) | default: `26214400` |
| `LOG_LEVEL` | Log level: debug, info, warn, error | default: `info` |
| `NGROK_AUTHTOKEN` | Ngrok auth token for public tunnel | optional |

### `backend/.env` — Local Development

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: `5000`) |
| `INSTANCE_ID` | Instance identifier for logging |
| `MONGODB_URI` | Full MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Same as above |
| `JWT_REFRESH_SECRET` | Same as above |
| `JWT_EXPIRES_IN` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL |
| `CLIENT_URL` | Primary allowed CORS origin |
| `CORS_ORIGINS` | Extra CORS origins (comma-separated) |
| `MINIO_ENDPOINT` | MinIO host (`localhost` for local, `minio` in Docker) |
| `MINIO_PORT` | MinIO port (default: `9000`) |
| `MINIO_USE_SSL` | Use SSL for MinIO (default: `false`) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO credentials |
| `MINIO_BUCKET` | Bucket name |
| `MAX_FILE_SIZE` | Max upload size in bytes |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limiting |
| `LOG_LEVEL` | Logging level |

### `frontend/.env` — Vite

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL (default: `/api/v1` — works with both Nginx and Vite proxy) |
| `VITE_SOCKET_URL` | Socket.IO URL (empty = same origin, recommended) |
| `VITE_BACKEND_URL` | Vite proxy target for local dev (default: `http://localhost:5000`) |

> **Tip:** In local development, the Vite dev server proxies `/api` and `/socket.io` to `VITE_BACKEND_URL`. This means you can use relative URLs everywhere and avoid CORS issues entirely.

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

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with instance ID and timestamp |

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
| `call_initiate` | `{ roomId, targetUserId, callType }` | Start a voice/video call |
| `call_accept` | `{ callId }` | Accept an incoming call |
| `call_reject` | `{ callId }` | Reject an incoming call |
| `call_end` | `{ callId }` | End an active call |

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
| `call_incoming` | `{ callId, roomId, callType, callerId, callerName }` | Incoming call notification |
| `call_accept` | `{ callId, userId, livekitUrl, livekitToken }` | Call accepted — includes LiveKit connection info |
| `call_reject` | `{ callId, userId }` | Call rejected by other party |
| `call_end` | `{ callId, endedBy }` | Call ended |
| `call_busy` | `{ targetUserId }` | Target user is already in a call |

---

## Horizontal Scaling

`docker-compose.yml` includes two backend nodes (`backend`, `backend2`) and two frontend nodes (`frontend`, `frontend2`) by default. Nginx distributes connections using `least_conn` for both upstreams.

Since all transports are forced to WebSocket (`transports: ['websocket']`), sticky sessions are not required. Once a WebSocket connection is established it stays on the same node for its lifetime. Cross-node messaging is handled transparently by the Redis Adapter.

The scheduled message runner uses a Redis `SET NX EX` distributed lock to guarantee only one node executes the cron job at a time.

---

## CORS Policy

The backend automatically allows the following origins:

- `CLIENT_URL` environment variable (single or comma-separated list)
- `CORS_ORIGINS` environment variable (extra origins, comma-separated)
- `localhost` and `127.x.x.x` on any port
- RFC-1918 private network addresses: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`
- In **development** mode (`NODE_ENV=development`), all origins are allowed

This means devices on the same Wi-Fi / LAN can access the app without any extra configuration.

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
| File Upload | Multer, Sharp (image processing) |
| Logging | Winston + daily-rotate-file |
| Scheduler | node-cron + Redis distributed lock |
| Proxy | Nginx Alpine |
| Tunnel | Ngrok |
| Containers | Docker, Docker Compose |

