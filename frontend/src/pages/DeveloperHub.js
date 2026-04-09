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
  Loader2
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl" data-testid="developer-hub">
      {/* Header */}
      <h1 className="text-2xl font-semibold mb-6">Workspace</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard 
          title="Active" 
          value={activeUnits.length} 
          icon={Play}
          color="text-blue-400"
        />
        <StatCard 
          title="In Review" 
          value={reviewUnits.length} 
          icon={FileText}
          color="text-yellow-400"
        />
        <StatCard 
          title="Revision" 
          value={revisionUnits.length} 
          icon={AlertCircle}
          color="text-red-400"
          highlight={revisionUnits.length > 0}
        />
        <StatCard 
          title="Completed" 
          value={completedUnits.length} 
          icon={CheckCircle2}
          color="text-emerald-400"
        />
      </div>

      {/* Revision Alert */}
      {revisionUnits.length > 0 && (
        <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
            <AlertCircle className="w-4 h-4" />
            Revision Required
          </div>
          <p className="text-zinc-400 text-sm">
            {revisionUnits.length} task{revisionUnits.length > 1 ? 's' : ''} need{revisionUnits.length === 1 ? 's' : ''} fixes
          </p>
        </div>
      )}

      {/* Next Task */}
      {nextTask ? (
        <div className="border border-zinc-800 rounded-xl p-5 mb-6 bg-[#111]">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            {nextTask.status === 'revision' ? 'Fix Required' : 'Next Task'}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{nextTask.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                <span className="capitalize">{nextTask.unit_type}</span>
                <span>·</span>
                <span>{nextTask.estimated_hours}h</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/developer/work/${nextTask.unit_id}`)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                nextTask.status === 'revision'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
              data-testid="open-next-task"
            >
              {nextTask.status === 'revision' ? 'Fix Now' : 'Open'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-zinc-800 border-dashed rounded-xl p-8 mb-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">No active tasks</p>
        </div>
      )}

      {/* Activity */}
      <div>
        <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-zinc-600 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((unit) => (
              <div 
                key={unit.unit_id}
                className="flex items-center gap-3 text-sm"
              >
                {unit.status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {unit.status === 'submitted' && (
                  <Clock className="w-4 h-4 text-yellow-400" />
                )}
                {unit.status === 'revision' && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-zinc-400">
                  {unit.status === 'completed' && 'Completed'}
                  {unit.status === 'submitted' && 'Submitted'}
                  {unit.status === 'revision' && 'Revision requested'}
                  : {unit.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, highlight }) => (
  <div className={`border rounded-xl p-4 ${highlight ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-[#111]'}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-zinc-500">{title}</span>
      <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.5} />
    </div>
    <div className="text-2xl font-semibold">{value}</div>
  </div>
);

export default DeveloperHub;
