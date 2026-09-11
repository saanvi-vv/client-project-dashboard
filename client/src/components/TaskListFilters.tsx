import React from 'react';
import { Task, TaskStatus, TaskPriority, Role } from '../types';
import { AlertTriangle, Clock, Calendar, CheckCircle2, CircleDashed, User as UserIcon, Tag } from 'lucide-react';

interface TaskListFiltersProps {
  tasks: Task[];
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  priorityFilter: string;
  setPriorityFilter: (val: string) => void;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  userRole: Role;
}

export const TaskListFilters: React.FC<TaskListFiltersProps> = ({
  tasks,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  onUpdateStatus,
  userRole
}) => {
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <CircleDashed className="w-3 h-3 text-slate-400" /> To Do
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3 text-sky-400" /> In Progress
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Tag className="w-3 h-3 text-amber-400" /> In Review
          </span>
        );
      case 'DONE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Done
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'LOW':
        return <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">LOW</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">MEDIUM</span>;
      case 'HIGH':
        return <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">HIGH</span>;
      case 'CRITICAL':
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">CRITICAL</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400">Filters:</span>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-white font-bold">{tasks.length}</span> tasks
        </div>
      </div>

      {/* Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-panel rounded-2xl border border-slate-800 text-slate-500 text-xs">
            No tasks match the filter criteria.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`glass-card p-4 rounded-2xl flex flex-col justify-between space-y-3 relative overflow-hidden ${
                task.isOverdue ? 'border-rose-500/40 bg-rose-950/10' : ''
              }`}
            >
              {task.isOverdue && (
                <div className="absolute top-0 right-0 bg-rose-500/20 text-rose-400 text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-xl border-l border-b border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Overdue
                </div>
              )}

              <div>
                <div className="flex items-center justify-between pr-16">
                  <span className="text-[11px] font-mono text-indigo-400 font-medium">
                    {task.project?.name || 'Project'}
                  </span>
                  {getPriorityBadge(task.priority)}
                </div>

                <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">
                  {task.title}
                </h3>
                
                {task.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Card Footer Actions & Status Dropdown */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    {task.assignee?.name || 'Unassigned'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Status Selector Dropdown */}
                <div className="flex items-center gap-2">
                  {userRole === 'DEVELOPER' || userRole === 'PROJECT_MANAGER' || userRole === 'ADMIN' ? (
                    <select
                      value={task.status}
                      onChange={(e) => onUpdateStatus(task.id, e.target.value as TaskStatus)}
                      className="bg-slate-900 border border-slate-700 text-[11px] text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 font-semibold"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                    </select>
                  ) : (
                    getStatusBadge(task.status)
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
