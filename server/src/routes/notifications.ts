import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

router.use(authenticate);

// GET /api/notifications - Get user notifications
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const notifications = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.userId, isRead: false }
    });

    return res.json({ status: 'success', data: { notifications, unreadCount } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    await prisma.notification.updateMany({
      where: { userId: user.userId, isRead: false },
      data: { isRead: true }
    });

    return res.json({ status: 'success', message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: { id, userId: user.userId },
      data: { isRead: true }
    });

    return res.json({ status: 'success', message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export const notificationRouter = router;
