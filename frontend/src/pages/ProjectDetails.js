import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  LifeBuoy,
  Layers,
  Code,
  FileText,
  Search,
  Compass,
  Palette,
  TestTube,
  Truck,
  Headphones,
  Play,
  AlertTriangle,
  Plus
} from 'lucide-react';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectRes, deliverablesRes, ticketsRes] = await Promise.all([
          axios.get(`${API}/projects/${projectId}`, { withCredentials: true }),
          axios.get(`${API}/projects/${projectId}/deliverables`, { withCredentials: true }),
          axios.get(`${API}/client/support-tickets`, { withCredentials: true }).catch(() => ({ data: [] }))
        ]);
        setProject(projectRes.data);
        setDeliverables(deliverablesRes.data);
        // Filter tickets for this project
        setTickets((ticketsRes.data || []).filter(t => t.project_id === projectId));
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const STAGES = [
    { id: 'discovery', label: 'Discovery', icon: Search, description: 'Understanding requirements' },
    { id: 'scope', label: 'Scope', icon: Compass, description: 'Defining project boundaries' },
    { id: 'design', label: 'Design', icon: Palette, description: 'UI/UX design phase' },
    { id: 'development', label: 'Development', icon: Code, description: 'Building features' },
    { id: 'qa', label: 'Testing', icon: TestTube, description: 'Quality assurance' },
    { id: 'delivery', label: 'Delivery', icon: Truck, description: 'Final delivery' },
    { id: 'support', label: 'Support', icon: Headphones, description: 'Ongoing support' },
  ];

  const getStageIndex = (stage) => STAGES.findIndex(s => s.id === stage);
  const currentStageIndex = project ? getStageIndex(project.current_stage) : 0;

  const pendingDeliverables = deliverables.filter(d => d.status === 'pending');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <button onClick={() => navigate('/client/dashboard')} className="text-white/50 hover:text-white">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl" data-testid="project-details">
      {/* Breadcrumb */}
      <button 
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Project Header */}
      <div className="border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-3 py-1 text-sm rounded-lg ${
                project.status === 'active' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : project.status === 'completed'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-white/5 text-white/50 border border-white/10'
              }`}>
                {project.status}
              </span>
              <span className="text-white/40 text-sm">Stage: <span className="text-white capitalize">{project.current_stage}</span></span>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            {pendingDeliverables.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <span className="text-amber-400 text-sm font-medium">
                  {pendingDeliverables.length} pending approval
                </span>
              </div>
            )}
            {openTickets.length > 0 && (
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <span className="text-blue-400 text-sm font-medium">
                  {openTickets.length} open tickets
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Approval Alert */}
      {pendingDeliverables.length > 0 && (
        <div className="mb-6 border-2 border-amber-500/50 rounded-2xl bg-amber-500/5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400">Delivery Ready for Review</h3>
                <p className="text-amber-400/70 text-sm">{pendingDeliverables[0].title}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/client/deliverable/${pendingDeliverables[0].deliverable_id}`)}
              className="px-5 py-2.5 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors"
            >
              Review Delivery
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.02]">
              <h2 className="font-semibold">Project Timeline</h2>
            </div>
            <div className="p-6">
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />
                <div 
                  className="absolute left-4 top-0 w-0.5 bg-emerald-500 transition-all"
                  style={{ height: `${((currentStageIndex + 1) / STAGES.length) * 100}%` }}
                />
                
                {/* Stages */}
                <div className="space-y-6">
                  {STAGES.map((stage, index) => {
                    const isComplete = index < currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const isFuture = index > currentStageIndex;
                    const Icon = stage.icon;
                    
                    return (
                      <div key={stage.id} className="relative flex items-start gap-4 pl-10">
                        {/* Dot */}
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                          isComplete ? 'bg-emerald-500 border-emerald-500' :
                          isCurrent ? 'bg-white border-white' :
                          'bg-transparent border-white/20'
                        }`} />
                        
                        {/* Content */}
                        <div className={`flex-1 ${isFuture ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isComplete ? 'bg-emerald-500/10' :
                              isCurrent ? 'bg-white/10' :
                              'bg-white/5'
                            }`}>
                              {isComplete ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : isCurrent ? (
                                <Play className="w-4 h-4 text-white" />
                              ) : (
                                <Icon className="w-4 h-4 text-white/30" />
                              )}
                            </div>
                            <div>
                              <h4 className={`font-medium ${isCurrent ? 'text-white' : ''}`}>{stage.label}</h4>
                              <p className="text-xs text-white/40">{stage.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Deliverables History */}
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <h2 className="font-semibold">Deliverables</h2>
              <span className="text-white/40 text-sm">{deliverables.length} total</span>
            </div>
            
            {deliverables.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No deliverables yet</p>
                <p className="text-white/30 text-xs mt-1">Deliveries will appear here as development progresses</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {deliverables.map(dlv => (
                  <button
                    key={dlv.deliverable_id}
                    onClick={() => navigate(`/client/deliverable/${dlv.deliverable_id}`)}
                    className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors group"
                    data-testid={`deliverable-${dlv.deliverable_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          dlv.status === 'approved' ? 'bg-emerald-500/10' :
                          dlv.status === 'pending' ? 'bg-amber-500/10' :
                          'bg-red-500/10'
                        }`}>
                          {dlv.status === 'approved' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : dlv.status === 'pending' ? (
                            <Clock className="w-5 h-5 text-amber-400" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium group-hover:text-white transition-colors">{dlv.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-white/40">{dlv.version}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              dlv.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                              dlv.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-red-500/10 text-red-400'
                            }`}>
                              {dlv.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold mb-4">Actions</h3>
            <div className="space-y-2">
              {pendingDeliverables.length > 0 && (
                <button
                  onClick={() => navigate(`/client/deliverable/${pendingDeliverables[0].deliverable_id}`)}
                  className="w-full p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all flex items-center gap-3"
                >
                  <Package className="w-4 h-4" />
                  Review Pending Delivery
                </button>
              )}
              <button
                onClick={() => navigate('/client/support', { state: { projectId } })}
                className="w-full p-3 border border-white/10 rounded-xl text-sm hover:bg-white/5 transition-all flex items-center gap-3"
              >
                <LifeBuoy className="w-4 h-4 text-white/50" />
                Create Support Ticket
              </button>
              <button
                onClick={() => navigate('/client/request/new')}
                className="w-full p-3 border border-white/10 rounded-xl text-sm hover:bg-white/5 transition-all flex items-center gap-3"
              >
                <Plus className="w-4 h-4 text-white/50" />
                Request New Feature
              </button>
            </div>
          </div>

          {/* Project Info */}
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.02]">
              <h3 className="font-semibold">Project Details</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Status</p>
                <p className="font-medium capitalize">{project.status}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Current Stage</p>
                <p className="font-medium capitalize">{project.current_stage}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Progress</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${((currentStageIndex + 1) / STAGES.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-white/60">
                    {Math.round(((currentStageIndex + 1) / STAGES.length) * 100)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Deliverables</p>
                <p className="font-medium">{deliverables.filter(d => d.status === 'approved').length} / {deliverables.length} approved</p>
              </div>
            </div>
          </div>

          {/* Recent Support Tickets */}
          {tickets.length > 0 && (
            <div className="border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                <h3 className="font-semibold">Support Tickets</h3>
                {openTickets.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
                    {openTickets.length} open
                  </span>
                )}
              </div>
              <div className="divide-y divide-white/5">
                {tickets.slice(0, 3).map(ticket => (
                  <div key={ticket.ticket_id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate">{ticket.title}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400' :
                        ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 capitalize">{ticket.ticket_type}</p>
                  </div>
                ))}
                <div className="p-4">
                  <button
                    onClick={() => navigate('/client/support')}
                    className="w-full text-center text-sm text-white/50 hover:text-white"
                  >
                    View all tickets
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
