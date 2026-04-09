import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import { AdminRealtimeBridge } from '@/components/RealtimeBridge';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code,
  Eye,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Target,
  User,
  Users,
  XCircle,
  Zap,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Bot,
  Play,
  Power
} from 'lucide-react';

const AdminControlCenter = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [overview, setOverview] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [actions, setActions] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningEngine, setRunningEngine] = useState(null);
  
  const [selectedProject, setSelectedProject] = useState('all');
  const [timeframe, setTimeframe] = useState('7d');

  const fetchData = async () => {
    try {
      const [overviewRes, pipelineRes, actionsRes, alertsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/admin/control-center/overview`, { withCredentials: true }),
        axios.get(`${API}/admin/control-center/pipeline`, { withCredentials: true }),
        axios.get(`${API}/admin/control-center/actions`, { withCredentials: true }),
        axios.get(`${API}/admin/system-alerts?resolved=false`, { withCredentials: true }),
        axios.get(`${API}/admin/system-settings`, { withCredentials: true })
      ]);
      
      setOverview(overviewRes.data);
      setPipeline(pipelineRes.data);
      setActions(actionsRes.data);
      setSystemAlerts(alertsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching control center data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const toggleAutoMode = async () => {
    const newMode = settings?.assignment_mode === 'auto' ? 'manual' : 'auto';
    try {
      await axios.post(`${API}/admin/system-settings?assignment_mode=${newMode}`, {}, { withCredentials: true });
      setSettings(prev => ({ ...prev, assignment_mode: newMode }));
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const runSystemEngines = async () => {
    setRunningEngine('all');
    try {
      await axios.post(`${API}/system/run-all`, {}, { withCredentials: true });
      await fetchData();
    } catch (error) {
      console.error('Error running engines:', error);
    } finally {
      setRunningEngine(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" data-testid="admin-control-center">
      {/* Realtime Bridge */}
      {user?.user_id && (
        <AdminRealtimeBridge userId={user.user_id} onRefresh={handleRefresh} />
      )}
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Control Center</h1>
                <p className="text-xs text-zinc-500">Live production overview</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-zinc-800" />
            
            <div className="flex items-center gap-3">
              <select 
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
              >
                <option value="all">All Projects</option>
                {overview?.projects?.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.name}</option>
                ))}
              </select>
              
              <select 
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* AUTO MODE Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950">
              <Bot className={`w-4 h-4 ${settings?.assignment_mode === 'auto' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className="text-xs text-zinc-400">AUTO</span>
              <button
                onClick={toggleAutoMode}
                data-testid="auto-mode-toggle"
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings?.assignment_mode === 'auto' ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings?.assignment_mode === 'auto' ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            
            {/* Run Engines Button */}
            <button 
              onClick={runSystemEngines}
              disabled={runningEngine}
              data-testid="run-engines-btn"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {runningEngine ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Engines
            </button>
            
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">{user?.name}</span>
              <button 
                onClick={logout}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {/* Auto Mode Banner */}
        {settings?.assignment_mode === 'auto' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/50 bg-emerald-500/10">
            <Bot className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <span className="text-sm font-medium text-emerald-400">Auto Mode Active</span>
              <span className="text-xs text-zinc-400 ml-2">System is automatically assigning tasks and managing priorities</span>
            </div>
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg">ENABLED</span>
          </div>
        )}
        
        {/* System Snapshot */}
        <SystemSnapshot stats={overview?.stats} />
        
        {/* Live Pipeline */}
        <LivePipeline pipeline={pipeline} navigate={navigate} settings={settings} />
        
        {/* System Alerts */}
        <SystemAlertsPanel alerts={systemAlerts} navigate={navigate} onRefresh={fetchData} />
        
        {/* Delivery Risks / Alerts */}
        <DeliveryRisks alerts={overview?.alerts || []} navigate={navigate} />
        
        {/* Team Health + Project Health */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TeamHealth team={overview?.team} navigate={navigate} />
          <ProjectHealth projects={overview?.projects || []} navigate={navigate} />
        </div>
        
        {/* Action Queue */}
        <ActionQueue actions={actions} navigate={navigate} onRefresh={fetchData} />
      </main>
    </div>
  );
};


// ============ SYSTEM SNAPSHOT ============

const SystemSnapshot = ({ stats }) => {
  const items = [
    { title: 'Active Units', value: stats?.active_units || 0, tone: 'default', icon: Activity },
    { title: 'In Review', value: stats?.in_review || 0, tone: stats?.in_review > 5 ? 'warning' : 'default', icon: Eye },
    { title: 'In Validation', value: stats?.in_validation || 0, tone: 'default', icon: Shield },
    { title: 'Blocked', value: stats?.blocked || 0, tone: stats?.blocked > 0 ? 'danger' : 'default', icon: XCircle },
    { title: 'Pending Deliverables', value: stats?.pending_deliverables || 0, tone: 'default', icon: FileText },
    { title: 'Overdue', value: stats?.overdue || 0, tone: stats?.overdue > 0 ? 'danger' : 'default', icon: Clock },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="system-snapshot">
      {items.map((item) => (
        <SnapshotCard key={item.title} {...item} />
      ))}
    </div>
  );
};

const SnapshotCard = ({ title, value, tone, icon: Icon }) => {
  const toneStyles = {
    default: 'border-zinc-800',
    warning: 'border-amber-700 bg-amber-500/5',
    danger: 'border-red-700 bg-red-500/5',
    success: 'border-emerald-700 bg-emerald-500/5',
  };

  const valueStyles = {
    default: 'text-white',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    success: 'text-emerald-400',
  };

  return (
    <div className={`rounded-2xl border bg-zinc-950 p-5 ${toneStyles[tone]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{title}</span>
        <Icon className={`w-4 h-4 ${valueStyles[tone] === 'text-white' ? 'text-zinc-500' : valueStyles[tone]}`} />
      </div>
      <div className={`text-3xl font-semibold ${valueStyles[tone]}`}>{value}</div>
    </div>
  );
};


// ============ LIVE PIPELINE ============

const LivePipeline = ({ pipeline, navigate }) => {
  const columns = [
    { key: 'backlog', title: 'Backlog', icon: Clock },
    { key: 'assigned', title: 'Assigned', icon: User },
    { key: 'in_progress', title: 'In Progress', icon: Code },
    { key: 'review', title: 'Review', icon: Eye },
    { key: 'validation', title: 'Validation', icon: Shield },
    { key: 'done', title: 'Done', icon: CheckCircle2 },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6" data-testid="live-pipeline">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Live Pipeline</h2>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Activity className="w-3 h-3" />
          Real-time
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {columns.map((col) => (
          <PipelineColumn 
            key={col.key}
            title={col.title}
            icon={col.icon}
            count={pipeline?.[col.key]?.count || 0}
            items={pipeline?.[col.key]?.items || []}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
};

const PipelineColumn = ({ title, icon: Icon, count, items, navigate }) => {
  const isDone = title === 'Done';
  
  return (
    <div className={`rounded-xl border p-4 min-h-[200px] ${isDone ? 'border-emerald-800/50 bg-emerald-500/5' : 'border-zinc-800 bg-black/50'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isDone ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
          {count}
        </span>
      </div>
      
      <div className="space-y-2">
        {items.slice(0, 3).map((item) => (
          <PipelineCard key={item.unit_id} item={item} navigate={navigate} />
        ))}
        {count > 3 && (
          <button className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-2">
            +{count - 3} more
          </button>
        )}
        {items.length === 0 && (
          <div className="text-xs text-zinc-600 text-center py-4">Empty</div>
        )}
      </div>
    </div>
  );
};

const PipelineCard = ({ item, navigate }) => (
  <div 
    onClick={() => navigate(`/admin/work-unit/${item.unit_id}`)}
    className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-zinc-600 ${
      item.is_revision ? 'border-amber-700/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950'
    }`}
  >
    <div className="flex items-center gap-1.5">
      <div className="text-sm font-medium truncate flex-1">{item.title}</div>
      {item.auto_assigned && (
        <Bot className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      )}
    </div>
    <div className="text-xs text-zinc-500 mt-1 truncate">{item.project} · {item.assignee}</div>
    {item.actual_hours > 0 && (
      <div className="text-xs text-zinc-600 mt-1">{item.actual_hours}h logged</div>
    )}
    <div className="flex gap-1 mt-2">
      {item.is_revision && (
        <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
          Revision
        </span>
      )}
      {item.auto_assigned && (
        <span className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded">
          Auto
        </span>
      )}
      {item.priority === 'high' && (
        <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
          High
        </span>
      )}
      {item.priority === 'critical' && (
        <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
          Critical
        </span>
      )}
    </div>
  </div>
);


// ============ SYSTEM ALERTS PANEL ============

const SystemAlertsPanel = ({ alerts, navigate, onRefresh }) => {
  const resolveAlert = async (alertId) => {
    try {
      await axios.post(`${API}/admin/system-alerts/${alertId}/resolve`, {}, { withCredentials: true });
      onRefresh();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  const severityOrder = { critical: 0, warning: 1 };
  const sortedAlerts = [...alerts].sort((a, b) => 
    (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
  );

  return (
    <div className="rounded-2xl border border-amber-800/50 bg-amber-500/5 p-6" data-testid="system-alerts">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <h2 className="font-semibold text-amber-400">System Alerts</h2>
        </div>
        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg">
          {alerts.length} active
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {sortedAlerts.slice(0, 4).map((alert) => (
          <div 
            key={alert.alert_id}
            className={`rounded-xl border bg-zinc-950 p-4 ${
              alert.severity === 'critical' ? 'border-red-700' : 'border-amber-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {alert.severity === 'critical' ? (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {alert.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="font-medium text-sm mt-2">{alert.message}</div>
                {alert.details?.unit_title && (
                  <div className="text-xs text-zinc-500 mt-1">{alert.details.unit_title}</div>
                )}
                {alert.details?.developer_name && (
                  <div className="text-xs text-zinc-500 mt-1">{alert.details.developer_name}</div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button 
                onClick={() => resolveAlert(alert.alert_id)}
                className="flex-1 px-2 py-1.5 border border-zinc-700 rounded-lg text-xs hover:bg-white/5 transition-colors"
              >
                Resolve
              </button>
              <button 
                onClick={() => {
                  if (alert.entity_type === 'work_unit') navigate(`/admin/work-unit/${alert.entity_id}`);
                }}
                className="flex-1 px-2 py-1.5 bg-white/10 rounded-lg text-xs hover:bg-white/20 transition-colors"
              >
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ============ DELIVERY RISKS ============

const DeliveryRisks = ({ alerts, navigate }) => {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-800/50 bg-emerald-500/5 p-6" data-testid="delivery-risks">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="font-semibold text-emerald-400">All Clear</h2>
            <p className="text-sm text-zinc-400">No delivery risks detected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-800/50 bg-red-500/5 p-6" data-testid="delivery-risks">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="font-semibold text-red-400">Delivery Risks</h2>
        </div>
        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">{alerts.length} issues</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {alerts.slice(0, 4).map((alert, i) => (
          <RiskCard key={i} alert={alert} navigate={navigate} />
        ))}
      </div>
    </div>
  );
};

const RiskCard = ({ alert, navigate }) => {
  const severityStyles = {
    warning: 'border-amber-700',
    danger: 'border-red-700',
  };

  return (
    <div className={`rounded-xl border bg-zinc-950 p-4 ${severityStyles[alert.severity] || 'border-zinc-800'}`}>
      <div className="font-medium text-sm">{alert.title}</div>
      <div className="text-xs text-zinc-400 mt-1">{alert.subtitle}</div>
      <button 
        onClick={() => {
          if (alert.unit_id) navigate(`/admin/work-unit/${alert.unit_id}`);
          else if (alert.project_id) navigate(`/client/projects/${alert.project_id}`);
        }}
        className="mt-3 px-3 py-1.5 border border-zinc-700 rounded-lg text-xs hover:bg-white/5 transition-colors"
      >
        {alert.action}
      </button>
    </div>
  );
};


// ============ TEAM HEALTH ============

const TeamHealth = ({ team, navigate }) => {
  const [tab, setTab] = useState('developers');
  
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6" data-testid="team-health">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Team Health</h2>
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
          <button 
            onClick={() => setTab('developers')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === 'developers' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            Developers ({team?.developers?.total || 0})
          </button>
          <button 
            onClick={() => setTab('testers')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === 'testers' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            Testers ({team?.testers?.total || 0})
          </button>
        </div>
      </div>
      
      {tab === 'developers' ? (
        <div className="space-y-4">
          {team?.developers?.overloaded?.length > 0 && (
            <div>
              <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Overloaded
              </div>
              <div className="space-y-2">
                {team.developers.overloaded.map(dev => (
                  <DeveloperCard key={dev.user_id} dev={dev} type="overloaded" />
                ))}
              </div>
            </div>
          )}
          
          {team?.developers?.top?.length > 0 && (
            <div>
              <div className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Top Performers
              </div>
              <div className="space-y-2">
                {team.developers.top.slice(0, 3).map(dev => (
                  <DeveloperCard key={dev.user_id} dev={dev} type="top" />
                ))}
              </div>
            </div>
          )}
          
          {team?.developers?.idle?.length > 0 && (
            <div>
              <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Available
              </div>
              <div className="space-y-2">
                {team.developers.idle.slice(0, 2).map(dev => (
                  <DeveloperCard key={dev.user_id} dev={dev} type="idle" />
                ))}
              </div>
            </div>
          )}
          
          {!team?.developers?.overloaded?.length && !team?.developers?.top?.length && !team?.developers?.idle?.length && (
            <div className="text-sm text-zinc-500 text-center py-8">No developers registered</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {team?.testers?.list?.length > 0 ? (
            team.testers.list.map(tester => (
              <TesterCard key={tester.user_id} tester={tester} />
            ))
          ) : (
            <div className="text-sm text-zinc-500 text-center py-8">No testers registered</div>
          )}
        </div>
      )}
    </div>
  );
};

const DeveloperCard = ({ dev, type }) => {
  const typeStyles = {
    overloaded: 'border-red-800/50',
    top: 'border-emerald-800/50',
    idle: 'border-zinc-800',
  };

  return (
    <div className={`rounded-xl border bg-black/50 p-4 ${typeStyles[type]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">{dev.name}</div>
          <div className="text-xs text-zinc-500">{dev.skills?.slice(0, 2).join(', ')}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{dev.score}</div>
          <div className="text-xs text-zinc-500">score</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span>Load: <span className={dev.load > 100 ? 'text-red-400' : ''}>{dev.load}%</span></span>
        <span>{dev.completed} completed</span>
      </div>
    </div>
  );
};

const TesterCard = ({ tester }) => (
  <div className="rounded-xl border border-zinc-800 bg-black/50 p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-sm">{tester.name}</div>
        <div className="text-xs text-zinc-500">{tester.validations} validations</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${tester.accuracy >= 90 ? 'text-emerald-400' : tester.accuracy >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
          {tester.accuracy}%
        </div>
        <div className="text-xs text-zinc-500">accuracy</div>
      </div>
    </div>
    <div className="mt-2 text-xs text-zinc-400">
      {tester.issues_found} issues found
    </div>
  </div>
);


// ============ PROJECT HEALTH ============

const ProjectHealth = ({ projects, navigate }) => {
  const statusStyles = {
    healthy: { border: 'border-emerald-800/50', badge: 'bg-emerald-500/20 text-emerald-400' },
    at_risk: { border: 'border-amber-800/50', badge: 'bg-amber-500/20 text-amber-400' },
    delayed: { border: 'border-red-800/50', badge: 'bg-red-500/20 text-red-400' },
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6" data-testid="project-health">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Project Health</h2>
        <span className="text-xs text-zinc-500">{projects.length} active</span>
      </div>
      
      <div className="space-y-3">
        {projects.length > 0 ? (
          projects.slice(0, 5).map(proj => {
            const style = statusStyles[proj.status] || statusStyles.healthy;
            return (
              <div 
                key={proj.project_id}
                onClick={() => navigate(`/client/projects/${proj.project_id}`)}
                className={`rounded-xl border bg-black/50 p-4 cursor-pointer hover:bg-white/5 transition-colors ${style.border}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{proj.name}</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${style.badge}`}>
                    {proj.status === 'at_risk' ? 'At Risk' : proj.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-zinc-400">
                  <div>
                    <div className="text-zinc-500">Progress</div>
                    <div className="text-white">{proj.progress}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Stage</div>
                    <div className="text-white capitalize">{proj.stage}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Revisions</div>
                    <div className={proj.revisions > 3 ? 'text-amber-400' : 'text-white'}>{proj.revisions}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Pending</div>
                    <div className="text-white">{proj.pending_approvals}</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-zinc-500 text-center py-8">No projects yet</div>
        )}
      </div>
    </div>
  );
};


// ============ ACTION QUEUE ============

const ActionQueue = ({ actions, navigate, onRefresh }) => {
  const handleAction = async (action) => {
    // Navigate based on action type
    switch (action.type) {
      case 'assign':
        navigate(`/admin/work-unit/${action.entity_id}`);
        break;
      case 'review':
        navigate(`/admin/dashboard`);
        break;
      case 'assign_tester':
        navigate(`/admin/dashboard`);
        break;
      case 'deliverable':
        navigate(`/client/deliverable/${action.entity_id}`);
        break;
      case 'ticket':
        // For now just refresh
        break;
      default:
        break;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6" data-testid="action-queue">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Action Queue</h2>
        </div>
        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg">
          {actions.length} pending
        </span>
      </div>
      
      {actions.length > 0 ? (
        <div className="space-y-3">
          {actions.slice(0, 6).map((action, i) => (
            <div 
              key={i}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/50 p-4"
            >
              <div>
                <div className="font-medium text-sm">{action.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{action.subtitle}</div>
              </div>
              <button 
                onClick={() => handleAction(action)}
                className="px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-colors"
              >
                {action.cta}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          <span className="text-sm">All caught up!</span>
        </div>
      )}
    </div>
  );
};


export default AdminControlCenter;
