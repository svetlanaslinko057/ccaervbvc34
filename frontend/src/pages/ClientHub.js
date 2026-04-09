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
  Clock
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
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="client-hub">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'Client'}
        </h1>
        <p className="text-white/50 mt-1">Here's what needs your attention</p>
      </div>

      {/* Pending Approvals Alert */}
      {pendingDeliverables.length > 0 && (
        <div className="card mb-8 border-white/30" data-testid="pending-section">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-white/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-medium">Awaiting Approval</span>
              <span className="text-white/40 text-sm ml-2">{pendingDeliverables.length} pending</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {pendingDeliverables.slice(0, 3).map(dlv => (
              <div 
                key={dlv.deliverable_id}
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div>
                  <h4 className="font-medium">{dlv.title}</h4>
                  <p className="text-sm text-white/40">{dlv.project_name} · {dlv.version}</p>
                </div>
                <button
                  onClick={() => navigate(`/client/deliverable/${dlv.deliverable_id}`)}
                  className="btn btn-primary btn-sm"
                  data-testid={`review-${dlv.deliverable_id}`}
                >
                  Review
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid mb-8">
        <StatCard label="Active Projects" value={activeProjects.length} />
        <StatCard label="Pending" value={pendingDeliverables.length} highlight={pendingDeliverables.length > 0} />
        <StatCard label="Open Tickets" value={openTickets.length} />
        <StatCard label="Completed" value={projects.filter(p => p.status === 'completed').length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-white/40" />
                Active Projects
              </h3>
              <button 
                onClick={() => navigate('/client/projects')}
                className="text-sm text-white/40 hover:text-white flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {activeProjects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderKanban className="w-10 h-10 text-white/20 mx-auto mb-4" />
                <h4 className="font-medium mb-2">No active projects</h4>
                <p className="text-sm text-white/40 mb-6">Start your first project request</p>
                <button
                  onClick={() => navigate('/client/request/new')}
                  className="btn btn-primary"
                  data-testid="new-project-btn"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
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
          <div className="card">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-white/40" />
                Support
              </h3>
              {openTickets.length > 0 && (
                <span className="badge badge-mono">{openTickets.length}</span>
              )}
            </div>
            
            {tickets.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-white/40">No tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tickets.slice(0, 3).map(ticket => (
                  <div key={ticket.ticket_id} className="p-4">
                    <h4 className="text-sm font-medium truncate">{ticket.title}</h4>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-white/40">{ticket.ticket_type}</span>
                      <span className={`badge badge-mono ${ticket.status === 'open' ? '' : 'badge-active'}`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => navigate('/client/support')}
                className="btn btn-secondary btn-sm w-full justify-center"
              >
                View All Tickets
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4">
            <h3 className="font-medium mb-4">Quick Actions</h3>
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

const StatCard = ({ label, value, highlight }) => (
  <div className={`stat-card ${highlight ? 'border-white/40' : ''}`}>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const ProjectRow = ({ project, onClick }) => {
  const stages = ['discovery', 'scope', 'design', 'development', 'qa', 'delivery'];
  const progress = Math.round(((stages.indexOf(project.current_stage) + 1) / stages.length) * 100);
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-white/5 transition-colors group"
      data-testid={`project-${project.project_id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium group-hover:text-white transition-colors">{project.name}</h4>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-mono text-xs text-white/40">{progress}%</span>
      </div>
      <p className="text-xs text-white/40 mt-2 capitalize">{project.current_stage}</p>
    </button>
  );
};

const ActionButton = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full p-3 border border-white/10 rounded-[8px] flex items-center gap-3 text-sm hover:bg-white/5 hover:border-white/20 transition-all"
  >
    <div className="w-8 h-8 rounded-[6px] bg-white/5 flex items-center justify-center text-white/60">
      {icon}
    </div>
    {label}
  </button>
);

export default ClientHub;
