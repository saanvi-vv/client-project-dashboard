import React from 'react';
import { useSocket } from '../context/SocketContext';
import { Activity, Clock, ShieldAlert, CheckCircle2, User, ArrowRight } from 'lucide-react';

export const LiveActivityFeed: React.FC = () => {
  const { activities } = useSocket();

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'STATUS_CHANGE':
        return <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'TASK_OVERDUE':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'TASK_CREATED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const past = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffMins = Math.floor((now - past) / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hrs ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Live Activity Feed</h2>
            <p className="text-[11px] text-slate-400">WebSocket role-filtered updates</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
          LIVE
        </span>
      </div>

      <div className="mt-4 space-y-3 overflow-y-auto max-h-[500px] pr-1">
        {activities.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
            No recent activity
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-3 text-xs group"
            >
              <div className="mt-0.5">{getActionBadge(act.action)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 leading-relaxed font-medium group-hover:text-white">
                  {act.details}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-400">
                    <User className="w-3 h-3 text-slate-500" />
                    {act.user?.name || 'System'}
                  </span>
                  <span>•</span>
                  <span>{timeAgo(act.createdAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
