import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ClipboardList,
  CheckCircle2,
  Play,
  FileText,
  Timer,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  ArrowUpRight,
  Zap
} from 'lucide-react';

const DeveloperDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [workUnits, setWorkUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignmentsRes, workUnitsRes] = await Promise.all([
          axios.get(`${API}/developer/assignments`, { withCredentials: true }),
          axios.get(`${API}/developer/work-units`, { withCredentials: true })
        ]);
        setAssignments(assignmentsRes.data);
        setWorkUnits(workUnitsRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      assigned: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: 'text-blue-400' },
      in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: 'text-amber-400' },
      submitted: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
      review: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: 'text-blue-400' },
      revision: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', icon: 'text-red-400' },
      completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
    };
    return colors[status] || { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10', icon: 'text-white/40' };
  };

  const activeUnits = workUnits.filter(u => ['assigned', 'in_progress'].includes(u.status));
  const revisionUnits = workUnits.filter(u => u.status === 'revision');
  const inReviewUnits = workUnits.filter(u => ['submitted', 'review', 'validation'].includes(u.status));
  const completedUnits = workUnits.filter(u => u.status === 'completed');
  const totalHours = workUnits.reduce((acc, u) => acc + (u.actual_hours || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" data-testid="developer-dashboard">
      {/* Background glow */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <div className="relative mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Workspace</h1>
        <p className="text-white/40 mt-2">Your active tasks and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Active" 
          value={activeUnits.length} 
          icon={<Play className="w-5 h-5" />}
          color="blue"
        />
        <StatCard 
          label="In Review" 
          value={inReviewUnits.length} 
          icon={<FileText className="w-5 h-5" />}
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

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content - Tasks */}
        <div className="col-span-8 space-y-6">
          {/* Revision Alert */}
          {revisionUnits.length > 0 && (
            <div className="p-5 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-400">Revision Required</h3>
                  <p className="text-sm text-white/40">{revisionUnits.length} tasks need your attention</p>
                </div>
              </div>
              <div className="space-y-2">
                {revisionUnits.map(unit => (
                  <TaskRow 
                    key={unit.unit_id} 
                    unit={unit} 
                    onClick={() => navigate(`/developer/work/${unit.unit_id}`)}
                    urgent
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Tasks */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0F] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-blue-400" />
                <h2 className="font-semibold">Active Tasks</h2>
              </div>
              <button 
                onClick={() => navigate('/developer/board')}
                className="text-sm text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              >
                View Board <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              {activeUnits.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-white/20" />
                  </div>
                  <h3 className="font-medium text-white/70 mb-2">No active tasks</h3>
                  <p className="text-sm text-white/40">New assignments will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeUnits.map((unit) => (
                    <TaskCard 
                      key={unit.unit_id} 
                      unit={unit} 
                      onClick={() => navigate(`/developer/work/${unit.unit_id}`)}
                      statusColor={getStatusColor(unit.status)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* In Review */}
          {inReviewUnits.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0F] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold">In Review</h2>
              </div>
              <div className="p-4 space-y-2">
                {inReviewUnits.map((unit) => (
                  <div
                    key={unit.unit_id}
                    className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-white/80">{unit.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg border ${getStatusColor(unit.status).bg} ${getStatusColor(unit.status).text} ${getStatusColor(unit.status).border}`}>
                        {unit.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-sm text-white/40">{unit.actual_hours}h logged</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Performance */}
        <div className="col-span-4 space-y-6">
          {/* Performance */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0F] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">Performance</h2>
            </div>
            <div className="p-5 space-y-4">
              <PerformanceItem label="Rating" value={user?.rating || '5.0'} suffix="/5" />
              <PerformanceItem label="Completed" value={completedUnits.length} suffix="tasks" />
              <PerformanceItem label="Hours Logged" value={totalHours} suffix="h" />
              <PerformanceItem label="Level" value={user?.level || 'Junior'} isText />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0F] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            <div className="p-5">
              {workUnits.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {workUnits.slice(0, 5).map(unit => (
                    <div key={unit.unit_id} className="flex items-center gap-3 text-sm">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(unit.status).bg}`} />
                      <span className="text-white/60 truncate flex-1">{unit.title}</span>
                      <span className="text-white/30 text-xs">{unit.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card
const StatCard = ({ label, value, icon, color, highlight }) => {
  const colors = {
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    white: 'text-white/50'
  };
  
  return (
    <div className={`p-5 rounded-2xl border bg-[#0A0A0F] transition-all ${
      highlight 
        ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent' 
        : 'border-white/[0.06]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/40 tracking-wide uppercase">{label}</span>
        <span className={colors[color]}>{icon}</span>
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
    </div>
  );
};

// Task Card
const TaskCard = ({ unit, onClick, statusColor }) => (
  <button
    onClick={onClick}
    className="w-full p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-blue-500/30 hover:bg-white/[0.04] transition-all group text-left"
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <h3 className="font-medium">{unit.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-lg border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
          {unit.status.replace('_', ' ')}
        </span>
      </div>
      <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" />
    </div>
    <p className="text-sm text-white/40 line-clamp-1 mb-4">{unit.description}</p>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white/40">{unit.estimated_hours}h est.</span>
        <span className="text-white/60">{unit.actual_hours || 0}h logged</span>
      </div>
      <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium group-hover:bg-blue-500 transition-colors">
        {unit.status === 'assigned' ? 'Start' : 'Continue'}
      </span>
    </div>
  </button>
);

// Task Row (for alerts)
const TaskRow = ({ unit, onClick, urgent }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${
      urgent 
        ? 'bg-white/[0.03] border-white/[0.06] hover:border-red-500/30 hover:bg-white/[0.05]'
        : 'bg-white/[0.03] border-white/[0.06] hover:border-blue-500/30 hover:bg-white/[0.05]'
    }`}
  >
    <div className="flex items-center gap-3">
      <AlertCircle className="w-4 h-4 text-red-400" />
      <span className="font-medium">{unit.title}</span>
    </div>
    <ChevronRight className={`w-4 h-4 transition-colors ${urgent ? 'text-white/30 group-hover:text-red-400' : 'text-white/30 group-hover:text-blue-400'}`} />
  </button>
);

// Performance Item
const PerformanceItem = ({ label, value, suffix, isText }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-white/40">{label}</span>
    <span className={`font-semibold ${isText ? 'text-blue-400 capitalize' : 'text-white'}`}>
      {value}{suffix && !isText && <span className="text-white/40 text-sm ml-1">{suffix}</span>}
    </span>
  </div>
);

export default DeveloperDashboard;
