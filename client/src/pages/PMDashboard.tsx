import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Task, Project, TaskStatus } from '../types';
import { LiveActivityFeed } from '../components/LiveActivityFeed';
import { TaskListFilters } from '../components/TaskListFilters';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { 
  Briefcase, 
  Plus, 
  Calendar, 
  Flame, 
  Clock
} from 'lucide-react';

export const PMDashboard: React.FC = () => {
  const { token } = useAuth();

  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchPMData = async () => {
    if (!token) return;
    try {
      const resStats = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data.data);
      }

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
    fetchPMData();
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
        fetchPMData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* PM Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Project Manager Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Managing <span className="text-indigo-400 font-bold">{stats?.myProjectsCount ?? 0}</span> projects assigned to your team.
          </p>
        </div>
        <button
          onClick={() => setIsTaskModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create & Assign Task
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Managed Projects */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">My Projects</p>
            <h2 className="text-2xl font-extrabold text-white mt-1">
              {stats?.myProjectsCount ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Critical Tasks */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Critical Priority Tasks</p>
            <h2 className="text-2xl font-extrabold text-rose-400 mt-1">
              {stats?.tasksByPriority?.CRITICAL ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Due This Week */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Due This Week</p>
            <h2 className="text-2xl font-extrabold text-amber-400 mt-1">
              {stats?.upcomingTasksThisWeek?.length ?? 0}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* In Review */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending My Review</p>
            <h2 className="text-2xl font-extrabold text-sky-400 mt-1">
              {tasks.filter(t => t.status === 'IN_REVIEW').length}
            </h2>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white">Project Tasks & Assignments</h2>
          
          <TaskListFilters
            tasks={tasks}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            onUpdateStatus={handleUpdateStatus}
            userRole="PROJECT_MANAGER"
          />
        </div>

        {/* Project Scoped Activity Feed */}
        <div className="lg:col-span-1">
          <LiveActivityFeed />
        </div>
      </div>

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
          fetchPMData();
        }}
        projects={projects}
      />
    </div>
  );
};
