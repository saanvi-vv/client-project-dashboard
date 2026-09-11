import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.use(authenticate);

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  managerId: z.string().uuid().optional() // if PM creates it, managerId defaults to PM
});

// GET /api/projects - Role-scoped project retrieval
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let whereClause = {};

    if (user.role === Role.PROJECT_MANAGER) {
      // PM can only see projects they created / manage
      whereClause = { managerId: user.userId };
    } else if (user.role === Role.DEVELOPER) {
      // Developer can only see projects where they have assigned tasks
      whereClause = {
        tasks: {
          some: { assigneeId: user.userId }
        }
      };
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: { select: { id: true, name: true, company: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ status: 'success', data: { projects } });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Scoped single project fetch
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        manager: { select: { id: true, name: true, email: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } }
          },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Role Security Check
    if (user.role === Role.PROJECT_MANAGER && project.managerId !== user.userId) {
      throw new AppError('Forbidden: You cannot access another PM\'s project', 403);
    }

    if (user.role === Role.DEVELOPER) {
      // Filter tasks to only those assigned to developer
      project.tasks = project.tasks.filter(t => t.assigneeId === user.userId);
      if (project.tasks.length === 0) {
        throw new AppError('Forbidden: You do not have assigned tasks in this project', 403);
      }
    }

    return res.json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Admin and PM can create projects
router.post('/', authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const body = createProjectSchema.parse(req.body);

    const managerId = user.role === Role.PROJECT_MANAGER ? user.userId : (body.managerId || user.userId);

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        clientId: body.clientId,
        managerId
      },
      include: {
        client: true,
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json({ status: 'success', data: { project } });
  } catch (error) {
    next(error);
  }
});

export const projectRouter = router;
