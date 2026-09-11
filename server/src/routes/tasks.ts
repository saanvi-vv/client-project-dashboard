import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Role, TaskStatus, TaskPriority } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { emitActivityEvent, emitNotification } from '../socket.js';

const router = Router();

router.use(authenticate);

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  dueDate: z.string().transform(str => new Date(str))
});

const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus)
});

// GET /api/tasks - Query parameter filtering (status, priority, dueDate range)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { status, priority, dueDateFrom, dueDateTo, projectId } = req.query;

    const where: any = {};

    // Role-based visibility filter
    if (user.role === Role.PROJECT_MANAGER) {
      where.project = { managerId: user.userId };
    } else if (user.role === Role.DEVELOPER) {
      where.assigneeId = user.userId;
    }

    if (projectId) where.projectId = String(projectId);
    if (status) where.status = String(status) as TaskStatus;
    if (priority) where.priority = String(priority) as TaskPriority;
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = new Date(String(dueDateFrom));
      if (dueDateTo) where.dueDate.lte = new Date(String(dueDateTo));
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, managerId: true } },
        assignee: { select: { id: true, name: true, email: true } }
      },
      orderBy: user.role === Role.DEVELOPER 
        ? [{ priority: 'desc' }, { dueDate: 'asc' }]
        : [{ dueDate: 'asc' }]
    });

    return res.json({ status: 'success', data: { tasks } });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks - Create task (Admin & PM only)
router.post('/', authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const data = createTaskSchema.parse(req.body);

    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (user.role === Role.PROJECT_MANAGER && project.managerId !== user.userId) {
      throw new AppError('Forbidden: Cannot add tasks to another PM\'s project', 403);
    }

    const isOverdue = data.dueDate < new Date() && data.status !== TaskStatus.DONE;

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        assigneeId: data.assigneeId,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        isOverdue
      },
      include: {
        project: { select: { id: true, name: true, managerId: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    // Record Activity Log
    const activityLog = await prisma.activityLog.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        userId: user.userId,
        action: 'TASK_CREATED',
        details: `created Task "${task.title}" (${task.status})`
      },
      include: { user: { select: { name: true, email: true, role: true } } }
    });

    // Real-time activity emission
    emitActivityEvent({
      id: activityLog.id,
      projectId: activityLog.projectId,
      taskId: activityLog.taskId,
      userId: activityLog.userId,
      action: activityLog.action,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      user: activityLog.user,
      project: { name: task.project.name, managerId: task.project.managerId },
      task: { title: task.title, assigneeId: task.assigneeId }
    });

    // Send Notification to developer if assigned
    if (task.assigneeId) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          taskId: task.id,
          message: `You were assigned task "${task.title}" in ${task.project.name}`
        }
      });
      emitNotification(task.assigneeId, notification);
    }

    return res.status(201).json({ status: 'success', data: { task } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/status - Update task status (Developer assigned or PM/Admin)
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status: newStatus } = updateTaskStatusSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true, assignee: true }
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Role Security Check
    if (user.role === Role.DEVELOPER && task.assigneeId !== user.userId) {
      throw new AppError('Forbidden: Developers can only update status of their assigned tasks', 403);
    }

    if (user.role === Role.PROJECT_MANAGER && task.project.managerId !== user.userId) {
      throw new AppError('Forbidden: Cannot update task in another PM\'s project', 403);
    }

    const oldStatus = task.status;
    if (oldStatus === newStatus) {
      return res.json({ status: 'success', data: { task } });
    }

    const isOverdue = task.dueDate < new Date() && newStatus !== TaskStatus.DONE;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: newStatus, isOverdue },
      include: {
        project: { select: { id: true, name: true, managerId: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    // Record Activity Log strictly in DB
    const currentUser = await prisma.user.findUnique({ where: { id: user.userId } });
    const formattedDetails = `${currentUser?.name || 'User'} moved Task "${task.title}" from ${oldStatus} → ${newStatus}`;

    const activityLog = await prisma.activityLog.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        userId: user.userId,
        action: 'STATUS_CHANGE',
        details: formattedDetails
      },
      include: { user: { select: { name: true, email: true, role: true } } }
    });

    // Broadcast live WebSocket event
    emitActivityEvent({
      id: activityLog.id,
      projectId: activityLog.projectId,
      taskId: activityLog.taskId,
      userId: activityLog.userId,
      action: activityLog.action,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      user: activityLog.user,
      project: { name: updatedTask.project.name, managerId: updatedTask.project.managerId },
      task: { title: updatedTask.title, assigneeId: updatedTask.assigneeId }
    });

    // Notification rule: When moved to IN_REVIEW, notify PM
    if (newStatus === TaskStatus.IN_REVIEW) {
      const pmNotification = await prisma.notification.create({
        data: {
          userId: updatedTask.project.managerId,
          taskId: updatedTask.id,
          message: `Task "${updatedTask.title}" was moved to In Review by ${currentUser?.name}`
        }
      });
      emitNotification(updatedTask.project.managerId, pmNotification);
    }

    return res.json({ status: 'success', data: { task: updatedTask } });
  } catch (error) {
    next(error);
  }
});

export const taskRouter = router;
