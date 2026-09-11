import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { TokenPayload } from './types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

let io: SocketIOServer | null = null;
const onlineUsers = new Map<string, number>(); // userId -> connection count

export const initSocket = (socketServer: SocketIOServer) => {
  io = socketServer;

  // Socket authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'default_access_secret') as TokenPayload;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    // Track online presence count
    const currentCount = onlineUsers.get(user.userId) || 0;
    onlineUsers.set(user.userId, currentCount + 1);
    broadcastPresenceUpdate();

    // Join role specific room
    socket.join(`role:${user.role}`);
    socket.join(`user:${user.userId}`);

    // Join project rooms
    socket.on('joinProject', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leaveProject', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
      const count = onlineUsers.get(user.userId) || 1;
      if (count <= 1) {
        onlineUsers.delete(user.userId);
      } else {
        onlineUsers.set(user.userId, count - 1);
      }
      broadcastPresenceUpdate();
    });
  });
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

export const broadcastPresenceUpdate = () => {
  if (!io) return;
  const activeCount = onlineUsers.size;
  io.emit('presence:update', { activeUsersCount: activeCount });
};

export const emitActivityEvent = (eventData: {
  id: string;
  projectId: string;
  taskId?: string | null;
  userId: string;
  action: string;
  details: string;
  createdAt: Date;
  user: { name: string; email: string; role: Role };
  project?: { name: string; managerId: string };
  task?: { title: string; assigneeId?: string | null };
}) => {
  if (!io) return;

  // 1. Broadcast to ADMIN room
  io.to('role:ADMIN').emit('activity:new', eventData);

  // 2. Broadcast to Project Manager if they own the project
  if (eventData.project?.managerId) {
    io.to(`user:${eventData.project.managerId}`).emit('activity:new', eventData);
  }

  // 3. Broadcast to assigned Developer if applicable
  if (eventData.task?.assigneeId) {
    io.to(`user:${eventData.task.assigneeId}`).emit('activity:new', eventData);
  }

  // 4. Also broadcast to anyone in project room
  io.to(`project:${eventData.projectId}`).emit('activity:project', eventData);
};

export const emitNotification = (userId: string, notificationData: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:new', notificationData);
};
