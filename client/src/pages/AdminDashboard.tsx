import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Task, Project, TaskStatus } from '../types';
import { LiveActivityFeed } from '../components/LiveActivityFeed';
import { TaskListFilters } from '../components/TaskListFilters';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users, 
  Plus,
  BarChart3
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const { onlineCount } = useSocket();

  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      // 1. Stats
      const resStats = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data.data);
      }

      // 2. Projects
      const resProjects = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resProjects.ok) {
        const data = await resProjects.json();
        setProjects(data.data.projects || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async () => {
    if (!token) return;
    try {
      let url = '/api/tasks?';
      if (statusFilter) url += `status=${statusFilter}&`;
      if (priorityFilter) url += `priority=${priorityFilter}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [token, statusFilter, priorityFilter]);

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTasks();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Admin Command Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global project metrics, live user presence, and real-time agency activities.
          </p>
        </div>
        <button
          onClick={() => setIsTaskModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Task
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Projects</p>
            <h2 className="text-2xl font-extrabold text-white mt-1">
              {stats?.totalProjects ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FolderKanban className="w-6 h-6" />
          </div>
        </div>

        {/* Total Tasks Status breakdown */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Completed Tasks</p>
            <h2 className="text-2xl font-extrabold text-emerald-400 mt-1">
              {stats?.tasksByStatus?.DONE ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue Count */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Overdue Tasks</p>
            <h2 className="text-2xl font-extrabold text-rose-400 mt-1">
              {stats?.overdueTaskCount ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Active Online Users Live */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Active Presence</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-2xl font-extrabold text-white">{onlineCount}</h2>
              <span className="text-xs text-slate-400 font-normal">/ {stats?.totalUsers ?? 7} users</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Task Board & Global Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Agency Master Task List
            </h2>
          </div>

          <TaskListFilters
            tasks={tasks}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            onUpdateStatus={handleUpdateStatus}
            userRole="ADMIN"
          />
        </div>

        {/* Global Live Feed */}
        <div className="lg:col-span-1">
          <LiveActivityFeed />
        </div>
      </div>

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
          fetchDashboardData();
        }}
        projects={projects}
      />
    </div>
  );
};
