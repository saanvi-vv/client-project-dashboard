import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /api/activity - Role-filtered activity feed (last 20 items or filtered)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    let where: any = {};

    if (user.role === Role.PROJECT_MANAGER) {
      where.project = { managerId: user.userId };
    } else if (user.role === Role.DEVELOPER) {
      where.task = { assigneeId: user.userId };
    }

    const activities = await prisma.activityLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, role: true } },
        project: { select: { name: true, managerId: true } },
        task: { select: { title: true, assigneeId: true } }
      }
    });

    return res.json({ status: 'success', data: { activities } });
  } catch (error) {
    next(error);
  }
});

export const activityRouter = router;
