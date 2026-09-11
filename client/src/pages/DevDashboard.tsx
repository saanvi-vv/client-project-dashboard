import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Task, TaskStatus } from '../types';
import { LiveActivityFeed } from '../components/LiveActivityFeed';
import { TaskListFilters } from '../components/TaskListFilters';
import { Code2, AlertTriangle, ListTodo } from 'lucide-react';

export const DevDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchDevTasks = async () => {
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
    fetchDevTasks();
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
        fetchDevTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const overdueCount = tasks.filter(t => t.isOverdue).length;
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      {/* Dev Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Developer Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, <span className="text-emerald-400 font-bold">{user?.name}</span>. Tasks sorted by Priority & Due Date.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Assigned Tasks</p>
            <h2 className="text-2xl font-extrabold text-white mt-1">{tasks.length}</h2>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ListTodo className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Active In Progress</p>
            <h2 className="text-2xl font-extrabold text-sky-400 mt-1">{inProgressCount}</h2>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Code2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Overdue Tasks</p>
            <h2 className="text-2xl font-extrabold text-rose-400 mt-1">{overdueCount}</h2>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Task List & Role-Filtered Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white">My Assigned Tasks</h2>

          <TaskListFilters
            tasks={tasks}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            onUpdateStatus={handleUpdateStatus}
            userRole="DEVELOPER"
          />
        </div>

        {/* Dev Scoped Live Activity Feed */}
        <div className="lg:col-span-1">
          <LiveActivityFeed />
        </div>
      </div>
    </div>
  );
};
