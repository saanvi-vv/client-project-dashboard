# AgencyPulse - Real-Time Client Project Dashboard

A production-grade, full-stack web application designed for digital agencies to manage client projects, track task progress, and monitor team activity with role-based security and live WebSocket updates.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)

---

## 🚀 Key Features

1. **Authentication & Role-Based Access Control (RBAC)**:
   - **JWT Dual Token System**: Short-lived Access Token (15m in memory) + Refresh Token stored in an `HttpOnly`, `SameSite=Lax` cookie.
   - **API-Level RBAC Enforcement**: Middleware strictly blocks unauthorized endpoints (e.g. Developers hitting Project Manager endpoints return `403 Forbidden`).
   - Three distinct roles: **Admin** (full access), **Project Manager** (own projects & assigned tasks), and **Developer** (assigned tasks only).

2. **Project & Task Management**:
   - Status tracking (`To Do`, `In Progress`, `In Review`, `Done`) and priority matrix (`Low`, `Medium`, `High`, `Critical`).
   - **DB-Persisted Status Logs**: Timestamped task state changes with user attribution stored directly in PostgreSQL.
   - **Background Cron Scheduler**: `node-cron` evaluates past-due tasks every minute and marks them `Overdue` in real time.

3. **Real-Time Activity Feed & Presence**:
   - Built using **Socket.io** with JWT authentication middleware.
   - **Role-Filtered Broadcasts**: Admins see global activity, PMs see project-owned activity, and Developers see assigned task activity.
   - **Missed Event Catchup**: Offline users reconnecting receive the last 20 missed activity events fetched directly from PostgreSQL.
   - **Live Presence Counter**: Real-time connected user tracking.

4. **Notifications System**:
   - Real-time in-app notifications delivered via WebSocket on task assignment or status updates (e.g. Developer moving task to `In Review` notifies PM).

---

## 🗄️ Database Schema & Indexing Decisions

```
+----------------+      +-------------------+      +--------------------+
|      User      |      |      Client       |      |      Project       |
+----------------+      +-------------------+      +--------------------+
| id (PK)        |      | id (PK)           |      | id (PK)            |
| email (Unique) |      | name              |      | name               |
| passwordHash   |      | email (Unique)    |----< | clientId (FK)      |
| role (Enum)    |      | company           |      | managerId (FK)     |
+----------------+      +-------------------+      +--------------------+
        |                                                    |
        +-------------------------+--------------------------+
                                  |
                                  v
                        +--------------------+
                        |        Task        |
                        +--------------------+
                        | id (PK)            |
                        | title              |
                        | projectId (FK)     |
                        | assigneeId (FK)    |
                        | status (Enum)      |
                        | priority (Enum)    |
                        | isOverdue (Bool)   |
                        | dueDate            |
                        +--------------------+
                                  |
                        +---------+---------+
                        |                   |
                        v                   v
              +-------------------+ +-------------------+
              |    ActivityLog    | |   Notification    |
              +-------------------+ +-------------------+
              | id (PK)           | | id (PK)           |
              | projectId (FK)    | | userId (FK)       |
              | userId (FK)       | | taskId (FK)       |
              | details           | | isRead (Bool)     |
              +-------------------+ +-------------------+
```

### Indexing Decisions:
- `Task(projectId, assigneeId, status)`: Accelerates composite query filtering when loading role-scoped task boards.
- `Task(dueDate)`: Optimizes background cron scanning for past-due tasks.
- `ActivityLog(projectId, createdAt)`: Ensures sub-millisecond retrieval for the last 20 missed activity feed items.
- `Notification(userId, isRead)`: Rapid lookup for unread notification count badge rendering.

---

## 🏗️ Architectural Decisions

| Decision | Selection | Justification |
| :--- | :--- | :--- |
| **WebSocket Library** | **Socket.io** | Selected over native WebSockets for built-in room abstractions (`socket.join('role:ADMIN')`), automatic reconnection, fallback transports, and heartbeat handling. |
| **Background Scheduler** | **node-cron** | Embedded directly into Node runtime to avoid external infrastructure overhead (like Redis/Bull) while guaranteeing 60-second cron ticks for overdue task evaluation. |
| **Token Storage** | **HttpOnly Cookies** | Storing refresh tokens in `HttpOnly` cookies eliminates XSS token-stealing vectors compared to `localStorage`. |
| **ORM** | **Prisma** | Provides strict TypeScript type safety, declarative schema migrations, and relational foreign key enforcement. |

---

## 🛠️ Local Setup Instructions (Docker)

### Prerequisites:
- Node.js v18+
- Docker & Docker Compose

### 1. Clone & Set Up Environment Variables:
```bash
git clone <your-repo-url>
cd client-project-dashboard
```

Create `server/.env`:
```env
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/client_dashboard?schema=public"
JWT_ACCESS_SECRET="super_secret_access_token_key_123456789"
JWT_REFRESH_SECRET="super_secret_refresh_token_key_987654321"
CLIENT_ORIGIN="http://localhost:5173"
```

### 2. Start PostgreSQL via Docker:
```bash
docker-compose up -d
```

### 3. Install Dependencies & Seed Database:
```bash
# Server Setup
cd server
npm install
npx prisma db push
npm run db:seed

# Client Setup
cd ../client
npm install
```

### 4. Run Development Servers:
```bash
# In server directory
npm run dev

# In client directory (another terminal)
npm run dev
```
Access the application at `http://localhost:5173`.

---

## 🔑 Seed User Demo Accounts

All pre-seeded accounts use password: `password123`

| Role | Name | Email | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | Sarah Connor | `admin@agency.com` | Full Agency Access & Global Activity Feed |
| **PM** | Ravi Sharma | `pm.ravi@agency.com` | Own Projects (Acme, Starlight) & Team Feed |
| **PM** | Elena Rostova | `pm.elena@agency.com` | Own Project (Nexus Healthcare) |
| **Developer** | Alex Chen | `dev.alex@agency.com` | Assigned Tasks & Assigned Activity Feed |
| **Developer** | Maria Garcia | `dev.maria@agency.com` | Assigned Tasks |
| **Developer** | Kenji Sato | `dev.kenji@agency.com` | Assigned Tasks |
| **Developer** | Zara Malik | `dev.zara@agency.com` | Assigned Tasks |

---

## 📝 Submission Explanation (150–250 Words)

**The Hardest Problem Solved**:
The most challenging aspect was implementing the real-time role-filtered activity feed with seamless offline catchup. Ensuring that live events were broadcast only to authorized roles without leaking data required dynamic room subscriptions in Socket.io based on JWT token scopes (`role:ADMIN`, `user:userId`, and `project:projectId`).

**How Real-Time Role-Filtered Feed Was Handled**:
When a task status changes, the server writes an explicit log entry to PostgreSQL and then emits the event to specific Socket.io rooms. Admins receive all events via `role:ADMIN`, Project Managers receive events for projects they manage via `user:pmId`, and Developers receive events for their assigned tasks via `user:devId`. When a user reconnects after being offline, the API queries the database with the user's role-based `where` filter to fetch the exact last 20 missed events.

**One Thing I'd Do Differently**:
If scaling this system for high-concurrency production, I would swap `node-cron` with a Redis-backed **BullMQ** queue to decouple background overdue processing from the main web server process and utilize Redis Pub/Sub for multi-node Socket.io horizontal scaling.

---

## ⚠️ Known Limitations
- Background job relies on server runtime remaining active (`node-cron`).
- Single-instance Socket.io in-memory presence tracking (would require Redis Adapter for multi-node clusters).
