export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  _count?: { projects: number };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  managerId: string;
  client?: Client;
  manager?: User;
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  isOverdue: boolean;
  dueDate: string;
  project?: { id: string; name: string; managerId: string };
  assignee?: User | null;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  taskId?: string | null;
  userId: string;
  action: string;
  details: string;
  createdAt: string;
  user: { name: string; email: string; role: Role };
  project?: { name: string; managerId: string };
  task?: { title: string; assigneeId?: string | null };
}

export interface NotificationItem {
  id: string;
  userId: string;
  taskId?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}
