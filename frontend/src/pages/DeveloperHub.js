import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  Play,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Zap,
  ArrowRight,
  BarChart3
} from 'lucide-react';

const DeveloperHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workUnits, setWorkUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/developer/work-units`, { withCredentials: true });
        setWorkUnits(res.data);
      } catch (error) {
        console.error('Error fetching work units:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeUnits = workUnits.filter(u => ['assigned', 'in_progress'].includes(u.status));
  const reviewUnits = workUnits.filter(u => ['submitted', 'validation'].includes(u.status));
  const revisionUnits = workUnits.filter(u => u.status === 'revision');
  const completedUnits = workUnits.filter(u => u.status === 'completed');

  // Next task priority: revision > active > new
  const nextTask = revisionUnits[0] || activeUnits[0] || null;

  // Recent activity (last 5 changes)
  const recentActivity = workUnits
    .filter(u => ['submitted', 'revision', 'completed'].includes(u.status))
    .slice(0, 5);

  const totalHours = workUnits.reduce((sum, u) => sum + (u.actual_hours || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" data-testid="developer-hub">
      {/* Background */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <div className="relative mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'Developer'}
        </h1>
        <p className="text-white/40 mt-2">Here's your workspace overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Active Tasks" 
          value={activeUnits.length} 
          icon={<Play className="w-5 h-5" />}
          color="blue"
        />
        <StatCard 
          label="In Review" 
          value={reviewUnits.length} 
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />
        <StatCard 
          label="Revision" 
          value={revisionUnits.length} 
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
          highlight={revisionUnits.length > 0}
        />
        <StatCard 
          label="Completed" 
          value={completedUnits.length} 
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Revision Alert */}
      {revisionUnits.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-400">Revision Required</h3>
                <p className="text-red-400/70 text-sm">
                  {revisionUnits.length} task{revisionUnits.length > 1 ? 's' : ''} need{revisionUnits.length === 1 ? 's' : ''} fixes
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/developer/work/${revisionUnits[0].unit_id}`)}
              className="px-5 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-400 transition-all shadow-lg shadow-red-500/20"
              data-testid="fix-now-btn"
            >
              Fix Now
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Next Task */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Task Card */}
          {nextTask ? (
            <div className="rounded-2xl border border-white/10 bg-[#1A1A23] overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wide">
                    {nextTask.status === 'revision' ? 'Fix Required' : 'Next Task'}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      nextTask.status === 'revision' 
                        ? 'bg-red-500/10 border border-red-500/20' 
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      {nextTask.status === 'revision' ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <Play className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{nextTask.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-white/40">
                        <span className="capitalize">{nextTask.unit_type || 'Task'}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>{nextTask.estimated_hours}h estimated</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>{nextTask.project_name || 'Project'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => navigate(`/developer/work/${nextTask.unit_id}`)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-medium rounded-xl transition-all ${
                      nextTask.status === 'revision'
                        ? 'bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20'
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                    }`}
                    data-testid="open-next-task"
                  >
                    {nextTask.status === 'revision' ? 'Fix Now' : 'Open Task'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate('/developer/board')}
                    className="px-6 py-3.5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:border-white/20 transition-all"
                  >
                    View Board
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#1A1A23] p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-white/40 mb-6">No active tasks at the moment</p>
              <button
                onClick={() => navigate('/developer/board')}
                className="px-6 py-3 border border-white/10 rounded-xl text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                View Work Board
              </button>
            </div>
          )}

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.03]">
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-white/40">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {recentActivity.map((unit) => (
                  <button 
                    key={unit.unit_id}
                    onClick={() => navigate(`/developer/work/${unit.unit_id}`)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-all text-left group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      unit.status === 'completed' ? 'bg-emerald-500/10' :
                      unit.status === 'submitted' ? 'bg-amber-500/10' :
                      'bg-red-500/10'
                    }`}>
                      {unit.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {unit.status === 'submitted' && <Clock className="w-4 h-4 text-amber-400" />}
                      {unit.status === 'revision' && <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-blue-400 transition-colors">{unit.title}</p>
                      <p className="text-sm text-white/40">
                        {unit.status === 'completed' && 'Completed'}
                        {unit.status === 'submitted' && 'Submitted for review'}
                        {unit.status === 'revision' && 'Revision requested'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Stats */}
        <div className="space-y-6">
          {/* Hours Card */}
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-blue-600/10 to-transparent p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Total Hours</span>
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-4xl font-bold text-white mb-1">{totalHours}<span className="text-xl text-white/30 ml-1">h</span></div>
            <p className="text-sm text-white/40">logged this month</p>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] p-5">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <ActionButton 
                icon={<Play className="w-4 h-4" />}
                label="View Work Board"
                onClick={() => navigate('/developer/board')}
              />
              <ActionButton 
                icon={<FileText className="w-4 h-4" />}
                label="All Assignments"
                onClick={() => navigate('/developer/assignments')}
              />
              <ActionButton 
                icon={<BarChart3 className="w-4 h-4" />}
                label="Performance"
                onClick={() => navigate('/developer/performance')}
              />
            </div>
          </div>

          {/* User Info */}
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-lg font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() || 'D'}
                </span>
              </div>
              <div>
                <p className="font-semibold">{user?.name || 'Developer'}</p>
                <p className="text-sm text-white/40 capitalize">{user?.level || 'Junior'} Developer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color, highlight }) => {
  const colors = {
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    emerald: 'text-emerald-400'
  };
  
  return (
    <div className={`p-5 rounded-2xl border bg-[#1A1A23] transition-all ${
      highlight ? 'border-red-500/40 bg-gradient-to-br from-red-500/15 to-[#1A1A23]' : 'border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>
        <span className={colors[color]}>{icon}</span>
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
    </div>
  );
};

const ActionButton = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full p-3 border border-white/10 rounded-xl flex items-center gap-3 text-sm hover:bg-white/[0.05] hover:border-white/20 transition-all"
  >
    <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center text-white/60">
      {icon}
    </div>
    {label}
  </button>
);

export default DeveloperHub;
