import { Router, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /api/dashboard/stats - Summary statistics tailored per role
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (user.role === Role.ADMIN) {
      const [totalProjects, tasksByStatus, overdueTaskCount, totalUsers] = await Promise.all([
        prisma.project.count(),
        prisma.task.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.task.count({ where: { isOverdue: true } }),
        prisma.user.count()
      ]);

      const formattedStatusMap = {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0
      };

      tasksByStatus.forEach(item => {
        formattedStatusMap[item.status] = item._count.status;
      });

      return res.json({
        status: 'success',
        data: {
          totalProjects,
          tasksByStatus: formattedStatusMap,
          overdueTaskCount,
          totalUsers
        }
      });
    }

    if (user.role === Role.PROJECT_MANAGER) {
      const projects = await prisma.project.findMany({
        where: { managerId: user.userId },
        select: { id: true, name: true, _count: { select: { tasks: true } } }
      });

      const projectIds = projects.map(p => p.id);

      const tasksByPriority = await prisma.task.groupBy({
        by: ['priority'],
        where: { projectId: { in: projectIds } },
        _count: { priority: true }
      });

      const upcomingDueDateEnd = new Date();
      upcomingDueDateEnd.setDate(upcomingDueDateEnd.getDate() + 7);

      const upcomingTasksThisWeek = await prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          dueDate: { gte: new Date(), lte: upcomingDueDateEnd },
          status: { not: 'DONE' }
        },
        take: 10,
        orderBy: { dueDate: 'asc' },
        include: { assignee: { select: { name: true } }, project: { select: { name: true } } }
      });

      return res.json({
        status: 'success',
        data: {
          myProjectsCount: projects.length,
          projectsSummary: projects,
          tasksByPriority: tasksByPriority.reduce((acc: any, curr) => {
            acc[curr.priority] = curr._count.priority;
            return acc;
          }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
          upcomingTasksThisWeek
        }
      });
    }

    if (user.role === Role.DEVELOPER) {
      const assignedTasks = await prisma.task.findMany({
        where: { assigneeId: user.userId },
        include: { project: { select: { name: true } } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }]
      });

      const overdueCount = assignedTasks.filter(t => t.isOverdue).length;

      return res.json({
        status: 'success',
        data: {
          assignedTasksCount: assignedTasks.length,
          overdueCount,
          tasks: assignedTasks
        }
      });
    }

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/users - Get list of users for dropdown assignments (Admin/PM)
router.get('/users', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    });

    return res.json({ status: 'success', data: { users } });
  } catch (error) {
    next(error);
  }
});

export const dashboardRouter = router;
