import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.use(authenticate);

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().min(2)
});

// GET /api/clients - Admin and PM can view clients list
router.get('/', authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { projects: true } }
      }
    });

    return res.json({ status: 'success', data: { clients } });
  } catch (error) {
    next(error);
  }
});

// POST /api/clients - Admin only can create client
router.post('/', authorize([Role.ADMIN]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = createClientSchema.parse(req.body);

    const existing = await prisma.client.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Client email already exists', 400);
    }

    const client = await prisma.client.create({ data });
    return res.status(201).json({ status: 'success', data: { client } });
  } catch (error) {
    next(error);
  }
});

export const clientRouter = router;
