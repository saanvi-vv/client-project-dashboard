import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import { initSocket } from './socket.js';
import { initCronJobs } from './jobs/overdueScheduler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { clientRouter } from './routes/clients.js';
import { projectRouter } from './routes/projects.js';
import { taskRouter } from './routes/tasks.js';
import { activityRouter } from './routes/activity.js';
import { notificationRouter } from './routes/notifications.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Socket.io Setup
const io = new SocketIOServer(server, {
  cors: {
    origin: [CLIENT_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
  }
});

initSocket(io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: [CLIENT_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/clients', clientRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/activity', activityRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/dashboard', dashboardRouter);

// Global Error Handler
app.use(errorHandler);

// Initialize Cron Job
initCronJobs();

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
