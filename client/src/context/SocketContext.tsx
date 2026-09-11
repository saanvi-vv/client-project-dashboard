import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { ActivityLog, NotificationItem } from '../types';

interface SocketContextType {
  socket: Socket | null;
  onlineCount: number;
  activities: ActivityLog[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  fetchNotifications: () => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  // Fetch initial missed activities (last 20 logs from DB)
  const fetchInitialActivities = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/activity?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.data.activities || []);
      }
    } catch (e) {
      console.error('Error loading activity feed:', e);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data.notifications || []);
        setUnreadNotificationCount(data.data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  };

  useEffect(() => {
    if (!token || !user) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    fetchInitialActivities();
    fetchNotifications();

    // Socket.io is optional — works in local dev but not on Vercel serverless
    try {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const newSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 3,
        timeout: 5000
      });

      newSocket.on('connect', () => {
        console.log('⚡ Socket connected:', newSocket.id);
      });

      newSocket.on('connect_error', () => {
        console.log('Socket.io not available (serverless mode) — using REST polling');
        newSocket.disconnect();
      });

      newSocket.on('presence:update', (data: { activeUsersCount: number }) => {
        setOnlineCount(data.activeUsersCount);
      });

      newSocket.on('activity:new', (newActivity: ActivityLog) => {
        setActivities((prev) => [newActivity, ...prev.slice(0, 19)]);
      });

      newSocket.on('notification:new', (newNotification: NotificationItem) => {
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadNotificationCount((prev) => prev + 1);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (e) {
      console.log('Socket.io initialization skipped');
    }
  }, [token, user]);

  const markAllNotificationsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const markNotificationRead = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineCount,
        activities,
        notifications,
        unreadNotificationCount,
        fetchNotifications,
        markAllNotificationsRead,
        markNotificationRead
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
