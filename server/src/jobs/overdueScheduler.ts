import cron from 'node-cron';
import { prisma } from '../prisma.js';
import { emitActivityEvent, emitNotification } from '../socket.js';
import { Role } from '@prisma/client';

export const initCronJobs = () => {
  // Run every minute to check past-due tasks
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find tasks past due date that are not DONE and not already marked isOverdue
      const overdueTasks = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { not: 'DONE' },
          isOverdue: false
        },
        include: {
          project: { select: { id: true, name: true, managerId: true } },
          assignee: { select: { id: true, name: true, email: true, role: true } }
        }
      });

      if (overdueTasks.length === 0) return;

      for (const task of overdueTasks) {
        // Update task isOverdue flag
        await prisma.task.update({
          where: { id: task.id },
          data: { isOverdue: true }
        });

        // System activity log for overdue task
        const activityLog = await prisma.activityLog.create({
          data: {
            projectId: task.projectId,
            taskId: task.id,
            userId: task.project.managerId, // Attribute to project manager or system
            action: 'TASK_OVERDUE',
            details: `Task "${task.title}" became Overdue (Due: ${task.dueDate.toISOString().split('T')[0]})`
          },
          include: {
            user: { select: { name: true, email: true, role: true } }
          }
        });

        // Real-time activity broadcast
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

        // Notify assignee if exists
        if (task.assigneeId) {
          const notification = await prisma.notification.create({
            data: {
              userId: task.assigneeId,
              taskId: task.id,
              message: `Task "${task.title}" is now overdue!`
            }
          });
          emitNotification(task.assigneeId, notification);
        }

        // Notify Project Manager
        const pmNotification = await prisma.notification.create({
          data: {
            userId: task.project.managerId,
            taskId: task.id,
            message: `Task "${task.title}" in project "${task.project.name}" is now overdue!`
          }
        });
        emitNotification(task.project.managerId, pmNotification);
      }
    } catch (error) {
      console.error('[Cron Job Error]:', error);
    }
  });

  console.log('✅ Overdue task background scheduler initialized (runs every minute)');
};
