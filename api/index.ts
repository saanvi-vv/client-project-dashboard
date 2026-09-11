import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient, Role, TaskStatus, TaskPriority } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ── Prisma ────────────────────────────────────────────────
const prisma = new PrismaClient();

// ── Express App ───────────────────────────────────────────
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Helpers ───────────────────────────────────────────────
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

interface TokenPayload { userId: string; email: string; role: Role; }

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) { super(message); this.statusCode = statusCode; }
}

// ── Auth Middleware ───────────────────────────────────────
function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ status: 'error', message: 'Token missing' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_ACCESS_SECRET) as TokenPayload;
    next();
  } catch { return res.status(401).json({ status: 'error', message: 'Invalid token' }); }
}

function authorize(roles: Role[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    next();
  };
}

// ── Validation Schemas ────────────────────────────────────
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const createTaskSchema = z.object({
  title: z.string().min(2), description: z.string().optional(), projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional().nullable(), status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM), dueDate: z.string().transform(s => new Date(s))
});
const updateStatusSchema = z.object({ status: z.nativeEnum(TaskStatus) });
const createProjectSchema = z.object({ name: z.string().min(2), description: z.string().optional(), clientId: z.string().uuid(), managerId: z.string().uuid().optional() });
const createClientSchema = z.object({ name: z.string().min(2), email: z.string().email(), company: z.string().min(2) });

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ══════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }
    const accessToken = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ status: 'success', data: { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (e: any) { return res.status(e instanceof z.ZodError ? 400 : 500).json({ status: 'error', message: e.message || 'Internal server error' }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const rt = req.cookies?.refreshToken;
    if (!rt) return res.status(401).json({ status: 'error', message: 'Refresh token missing' });
    let decoded: any;
    try { decoded = jwt.verify(rt, JWT_REFRESH_SECRET); } catch { return res.status(401).json({ status: 'error', message: 'Invalid refresh token' }); }
    const stored = await prisma.refreshToken.findUnique({ where: { token: rt }, include: { user: true } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      return res.status(401).json({ status: 'error', message: 'Refresh token expired' });
    }
    const newAccessToken = jwt.sign({ userId: stored.user.id, email: stored.user.email, role: stored.user.role }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    return res.json({ status: 'success', data: { accessToken: newAccessToken, user: { id: stored.user.id, name: stored.user.name, email: stored.user.email, role: stored.user.role } } });
  } catch (e: any) { return res.status(500).json({ status: 'error', message: 'Internal server error' }); }
});

app.post('/api/auth/logout', async (req, res) => {
  const rt = req.cookies?.refreshToken;
  if (rt) await prisma.refreshToken.deleteMany({ where: { token: rt } }).catch(() => {});
  res.clearCookie('refreshToken');
  return res.json({ status: 'success', message: 'Logged out' });
});

app.get('/api/auth/me', authenticate, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  return res.json({ status: 'success', data: { user } });
});

// ══════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════
app.get('/api/clients', authenticate, authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { projects: true } } } });
  return res.json({ status: 'success', data: { clients } });
});

app.post('/api/clients', authenticate, authorize([Role.ADMIN]), async (req, res) => {
  try {
    const body = createClientSchema.parse(req.body);
    const existing = await prisma.client.findUnique({ where: { email: body.email } });
    if (existing) return res.status(400).json({ status: 'error', message: 'Client email already exists' });
    const client = await prisma.client.create({ data: { name: body.name, email: body.email, company: body.company } });
    return res.status(201).json({ status: 'success', data: { client } });
  } catch (e: any) { return res.status(400).json({ status: 'error', message: e.message }); }
});

// ══════════════════════════════════════════════════════════
// PROJECTS
// ══════════════════════════════════════════════════════════
app.get('/api/projects', authenticate, async (req: any, res) => {
  let where: any = {};
  if (req.user.role === Role.PROJECT_MANAGER) where = { managerId: req.user.userId };
  else if (req.user.role === Role.DEVELOPER) where = { tasks: { some: { assigneeId: req.user.userId } } };
  const projects = await prisma.project.findMany({ where, include: { client: { select: { id: true, name: true, company: true } }, manager: { select: { id: true, name: true, email: true } }, _count: { select: { tasks: true } } }, orderBy: { createdAt: 'desc' } });
  return res.json({ status: 'success', data: { projects } });
});

app.get('/api/projects/:id', authenticate, async (req: any, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { client: true, manager: { select: { id: true, name: true, email: true } }, tasks: { include: { assignee: { select: { id: true, name: true, email: true } } }, orderBy: { dueDate: 'asc' } } } });
  if (!project) return res.status(404).json({ status: 'error', message: 'Project not found' });
  if (req.user.role === Role.PROJECT_MANAGER && project.managerId !== req.user.userId) return res.status(403).json({ status: 'error', message: 'Forbidden' });
  if (req.user.role === Role.DEVELOPER) { project.tasks = project.tasks.filter(t => t.assigneeId === req.user.userId); if (project.tasks.length === 0) return res.status(403).json({ status: 'error', message: 'Forbidden' }); }
  return res.json({ status: 'success', data: { project } });
});

app.post('/api/projects', authenticate, authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (req: any, res) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const managerId = req.user.role === Role.PROJECT_MANAGER ? req.user.userId : (body.managerId || req.user.userId);
    const project = await prisma.project.create({ data: { name: body.name, description: body.description, clientId: body.clientId, managerId }, include: { client: true, manager: { select: { id: true, name: true, email: true } } } });
    return res.status(201).json({ status: 'success', data: { project } });
  } catch (e: any) { return res.status(400).json({ status: 'error', message: e.message }); }
});

// ══════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════
app.get('/api/tasks', authenticate, async (req: any, res) => {
  const { status, priority, dueDateFrom, dueDateTo, projectId } = req.query;
  const where: any = {};
  if (req.user.role === Role.PROJECT_MANAGER) where.project = { managerId: req.user.userId };
  else if (req.user.role === Role.DEVELOPER) where.assigneeId = req.user.userId;
  if (projectId) where.projectId = String(projectId);
  if (status) where.status = String(status) as TaskStatus;
  if (priority) where.priority = String(priority) as TaskPriority;
  if (dueDateFrom || dueDateTo) { where.dueDate = {}; if (dueDateFrom) where.dueDate.gte = new Date(String(dueDateFrom)); if (dueDateTo) where.dueDate.lte = new Date(String(dueDateTo)); }
  const tasks = await prisma.task.findMany({ where, include: { project: { select: { id: true, name: true, managerId: true } }, assignee: { select: { id: true, name: true, email: true } } }, orderBy: req.user.role === Role.DEVELOPER ? [{ priority: 'desc' }, { dueDate: 'asc' }] : [{ dueDate: 'asc' }] });
  return res.json({ status: 'success', data: { tasks } });
});

app.post('/api/tasks', authenticate, authorize([Role.ADMIN, Role.PROJECT_MANAGER]), async (req: any, res) => {
  try {
    const data = createTaskSchema.parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) return res.status(404).json({ status: 'error', message: 'Project not found' });
    if (req.user.role === Role.PROJECT_MANAGER && project.managerId !== req.user.userId) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    const isOverdue = data.dueDate < new Date() && data.status !== TaskStatus.DONE;
    const task = await prisma.task.create({ data: { title: data.title, description: data.description, projectId: data.projectId, assigneeId: data.assigneeId, status: data.status, priority: data.priority, dueDate: data.dueDate, isOverdue }, include: { project: { select: { id: true, name: true, managerId: true } }, assignee: { select: { id: true, name: true, email: true, role: true } } } });
    await prisma.activityLog.create({ data: { projectId: task.projectId, taskId: task.id, userId: req.user.userId, action: 'TASK_CREATED', details: `created Task "${task.title}" (${task.status})` } });
    if (task.assigneeId) { await prisma.notification.create({ data: { userId: task.assigneeId, taskId: task.id, message: `You were assigned task "${task.title}" in ${task.project.name}` } }); }
    return res.status(201).json({ status: 'success', data: { task } });
  } catch (e: any) { return res.status(400).json({ status: 'error', message: e.message }); }
});

app.patch('/api/tasks/:id/status', authenticate, async (req: any, res) => {
  try {
    const { status: newStatus } = updateStatusSchema.parse(req.body);
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { project: true, assignee: true } });
    if (!task) return res.status(404).json({ status: 'error', message: 'Task not found' });
    if (req.user.role === Role.DEVELOPER && task.assigneeId !== req.user.userId) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    if (req.user.role === Role.PROJECT_MANAGER && task.project.managerId !== req.user.userId) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    const oldStatus = task.status;
    if (oldStatus === newStatus) return res.json({ status: 'success', data: { task } });
    const isOverdue = task.dueDate < new Date() && newStatus !== TaskStatus.DONE;
    const updatedTask = await prisma.task.update({ where: { id: req.params.id }, data: { status: newStatus, isOverdue }, include: { project: { select: { id: true, name: true, managerId: true } }, assignee: { select: { id: true, name: true, email: true, role: true } } } });
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    await prisma.activityLog.create({ data: { projectId: task.projectId, taskId: task.id, userId: req.user.userId, action: 'STATUS_CHANGE', details: `${currentUser?.name || 'User'} moved Task "${task.title}" from ${oldStatus} → ${newStatus}` } });
    if (newStatus === TaskStatus.IN_REVIEW) { await prisma.notification.create({ data: { userId: updatedTask.project.managerId, taskId: updatedTask.id, message: `Task "${updatedTask.title}" was moved to In Review by ${currentUser?.name}` } }); }
    return res.json({ status: 'success', data: { task: updatedTask } });
  } catch (e: any) { return res.status(400).json({ status: 'error', message: e.message }); }
});

// ══════════════════════════════════════════════════════════
// ACTIVITY
// ══════════════════════════════════════════════════════════
app.get('/api/activity', authenticate, async (req: any, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  let where: any = {};
  if (req.user.role === Role.PROJECT_MANAGER) where.project = { managerId: req.user.userId };
  else if (req.user.role === Role.DEVELOPER) where.task = { assigneeId: req.user.userId };
  const activities = await prisma.activityLog.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true, role: true } }, project: { select: { name: true, managerId: true } }, task: { select: { title: true, assigneeId: true } } } });
  return res.json({ status: 'success', data: { activities } });
});

// ══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════
app.get('/api/notifications', authenticate, async (req: any, res) => {
  const notifications = await prisma.notification.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' }, take: 30 });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.userId, isRead: false } });
  return res.json({ status: 'success', data: { notifications, unreadCount } });
});

app.patch('/api/notifications/read-all', authenticate, async (req: any, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.userId, isRead: false }, data: { isRead: true } });
  return res.json({ status: 'success', message: 'All marked as read' });
});

app.patch('/api/notifications/:id/read', authenticate, async (req: any, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.userId }, data: { isRead: true } });
  return res.json({ status: 'success', message: 'Marked as read' });
});

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
app.get('/api/dashboard/stats', authenticate, async (req: any, res) => {
  if (req.user.role === Role.ADMIN) {
    const [totalProjects, tasksByStatus, overdueTaskCount, totalUsers] = await Promise.all([
      prisma.project.count(), prisma.task.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.task.count({ where: { isOverdue: true } }), prisma.user.count()
    ]);
    const sm: any = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
    tasksByStatus.forEach(i => { sm[i.status] = i._count.status; });
    return res.json({ status: 'success', data: { totalProjects, tasksByStatus: sm, overdueTaskCount, totalUsers } });
  }
  if (req.user.role === Role.PROJECT_MANAGER) {
    const projects = await prisma.project.findMany({ where: { managerId: req.user.userId }, select: { id: true, name: true, _count: { select: { tasks: true } } } });
    const pids = projects.map(p => p.id);
    const tasksByPriority = await prisma.task.groupBy({ by: ['priority'], where: { projectId: { in: pids } }, _count: { priority: true } });
    const end = new Date(); end.setDate(end.getDate() + 7);
    const upcomingTasksThisWeek = await prisma.task.findMany({ where: { projectId: { in: pids }, dueDate: { gte: new Date(), lte: end }, status: { not: 'DONE' } }, take: 10, orderBy: { dueDate: 'asc' }, include: { assignee: { select: { name: true } }, project: { select: { name: true } } } });
    const tp: any = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    tasksByPriority.forEach(i => { tp[i.priority] = i._count.priority; });
    return res.json({ status: 'success', data: { myProjectsCount: projects.length, projectsSummary: projects, tasksByPriority: tp, upcomingTasksThisWeek } });
  }
  if (req.user.role === Role.DEVELOPER) {
    const assignedTasks = await prisma.task.findMany({ where: { assigneeId: req.user.userId }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }] });
    return res.json({ status: 'success', data: { assignedTasksCount: assignedTasks.length, overdueCount: assignedTasks.filter(t => t.isOverdue).length, tasks: assignedTasks } });
  }
  return res.json({ status: 'success', data: {} });
});

app.get('/api/dashboard/users', authenticate, async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
  return res.json({ status: 'success', data: { users } });
});

// ── Error handler ────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[API Error]:', err);
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Internal server error' });
});

export default function handler(req: any, res: any) {
  return app(req, res);
}
