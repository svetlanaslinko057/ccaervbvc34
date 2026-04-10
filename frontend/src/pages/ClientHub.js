import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  FolderKanban,
  Package,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  LifeBuoy,
  Plus,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react';

const ClientHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, ticketsRes] = await Promise.all([
          axios.get(`${API}/projects/mine`, { withCredentials: true }),
          axios.get(`${API}/client/support-tickets`, { withCredentials: true }).catch(() => ({ data: [] }))
        ]);
        setProjects(projectsRes.data);
        setTickets(ticketsRes.data || []);
        
        // Fetch deliverables
        const allDeliverables = [];
        for (const project of projectsRes.data) {
          try {
            const dlvRes = await axios.get(`${API}/projects/${project.project_id}/deliverables`, { withCredentials: true });
            allDeliverables.push(...dlvRes.data.map(d => ({ ...d, project_name: project.name })));
          } catch (e) {}
        }
        setDeliverables(allDeliverables);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const pendingDeliverables = deliverables.filter(d => d.status === 'pending');
  const activeProjects = projects.filter(p => p.status === 'active');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" data-testid="client-hub">
      {/* Background */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <div className="relative mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'Client'}
        </h1>
        <p className="text-white/40 mt-2">Here's what needs your attention</p>
      </div>

      {/* Pending Approvals Alert */}
      {pendingDeliverables.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-6 mb-8" data-testid="pending-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400">Awaiting Your Approval</h3>
                <p className="text-amber-400/70 text-sm">{pendingDeliverables.length} deliverable{pendingDeliverables.length > 1 ? 's' : ''} ready for review</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/client/deliverable/${pendingDeliverables[0].deliverable_id}`)}
              className="px-5 py-2.5 bg-amber-500 text-black font-medium rounded-xl hover:bg-amber-400 transition-all"
              data-testid={`review-${pendingDeliverables[0].deliverable_id}`}
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Active Projects" 
          value={activeProjects.length}
          icon={<FolderKanban className="w-5 h-5" />}
          color="blue"
        />
        <StatCard 
          label="Pending Approval" 
          value={pendingDeliverables.length}
          icon={<Package className="w-5 h-5" />}
          color="amber"
          highlight={pendingDeliverables.length > 0}
        />
        <StatCard 
          label="Open Tickets" 
          value={openTickets.length}
          icon={<LifeBuoy className="w-5 h-5" />}
          color="blue"
        />
        <StatCard 
          label="Completed" 
          value={projects.filter(p => p.status === 'completed').length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-white/40" />
                Active Projects
              </h3>
              <button 
                onClick={() => navigate('/client/projects')}
                className="text-sm text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {activeProjects.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto mb-4 flex items-center justify-center">
                  <FolderKanban className="w-8 h-8 text-white/20" />
                </div>
                <h4 className="font-semibold mb-2">No active projects</h4>
                <p className="text-sm text-white/40 mb-6">Start your first project request</p>
                <button
                  onClick={() => navigate('/client/request/new')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
                  data-testid="new-project-btn"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {activeProjects.slice(0, 4).map((project) => (
                  <ProjectRow 
                    key={project.project_id}
                    project={project}
                    onClick={() => navigate(`/client/projects/${project.project_id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Support */}
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-white/40" />
                Support
              </h3>
              {openTickets.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                  {openTickets.length} open
                </span>
              )}
            </div>
            
            {tickets.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-white/40">No support tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {tickets.slice(0, 3).map(ticket => (
                  <div key={ticket.ticket_id} className="p-4">
                    <h4 className="text-sm font-medium truncate">{ticket.title}</h4>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-white/40 capitalize">{ticket.ticket_type}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-lg ${
                        ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400' :
                        ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => navigate('/client/support')}
                className="w-full py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                View All Tickets
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-white/10 bg-[#1A1A23] p-5">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <ActionButton 
                icon={<Plus className="w-4 h-4" />}
                label="New Project"
                onClick={() => navigate('/client/request/new')}
              />
              <ActionButton 
                icon={<LifeBuoy className="w-4 h-4" />}
                label="Get Support"
                onClick={() => navigate('/client/support')}
              />
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
    emerald: 'text-emerald-400'
  };
  
  return (
    <div className={`p-5 rounded-2xl border bg-[#1A1A23] transition-all ${
      highlight ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-[#1A1A23]' : 'border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>
        <span className={colors[color]}>{icon}</span>
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
    </div>
  );
};

const ProjectRow = ({ project, onClick }) => {
  const stages = ['discovery', 'scope', 'design', 'development', 'qa', 'delivery'];
  const progress = Math.round(((stages.indexOf(project.current_stage) + 1) / stages.length) * 100);
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 hover:bg-white/[0.02] transition-all group"
      data-testid={`project-${project.project_id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium group-hover:text-blue-400 transition-colors">{project.name}</h4>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-white/40 font-mono">{progress}%</span>
      </div>
      <p className="text-xs text-white/40 mt-2 capitalize">Stage: {project.current_stage}</p>
    </button>
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

export default ClientHub;
